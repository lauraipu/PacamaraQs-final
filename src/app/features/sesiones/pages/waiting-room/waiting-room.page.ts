import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import {
  AlertController, IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader,
  IonIcon, IonItem, IonLabel, IonList, IonSpinner, IonTitle, IonToolbar, ModalController, ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, cloudOfflineOutline, copyOutline, createOutline, exitOutline, lockClosedOutline,
  peopleOutline, refreshOutline, warningOutline
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import {
  CATADORES_RECOMENDADOS, catadoresSonRecomendados, EstadoSesion, getFormatoById, Participante, Sesion
} from '@domain/sesion/sesion.model';
import { EditarSesionModalComponent, ResultadoEdicionSesion } from '../../ui/editar-sesion/editar-sesion-modal.component';
import { AuthService } from '@core/auth/auth.service';
import { EventoSala, GRACE_PERIOD_MS, RealtimeService, SalaRealtime } from '@core/realtime/sala-realtime.service';
import { SesionesRepository } from '@core/data-access/sesiones/sesiones.repository';
import { mensajeDeError } from '@core/errores/errores';

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TrPipe } from '@core/i18n/tr';
import { BotonGuiaComponent } from '@shared/components/boton-guia/boton-guia.component';
/** Mínimo para iniciar. 3 o más (e impar) es solo una recomendación. */
const MINIMO_CATADORES = 1;
const TIEMPO_MAXIMO_CARGA_MS = 15_000;
const SONDEO_SIN_SOCKET_MS = 10_000;

const RUTAS_FORMULARIO: Readonly<Record<string, string>> = {
  combinado: 'combined-form',
  afectivo: 'affective-form',
  descriptivo: 'descriptive-form',
  extrinseca: 'extrinsic-form'
};

export type ConexionParticipante = 'en_linea' | 'inestable' | 'desconectado';

export interface ParticipanteEnSala extends Participante {
  conexion: ConexionParticipante;
  segundosGracia: number | null;
}

function conTiempoLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(
      () => reject(new Error('La conexión está tardando demasiado. Revisa tu red e intenta de nuevo.')),
      ms
    );
    promesa.then(
      valor => { clearTimeout(id); resolve(valor); },
      error => { clearTimeout(id); reject(error); }
    );
  });
}

/**
 * Sala de espera (lobby).
 *  · Estado autoritativo: BD (sesiones / participantes) vía REST.
 *  · Presence: quién está conectado; LEAVE → "Inestable" (amarillo) con
 *    cuenta regresiva de 45 s; al vencer, RealtimeService del organizador
 *    ejecuta abandonar_sesion.
 *  · Broadcast: LISTO e INICIAR_CATA llegan al instante; antes de navegar se
 *    confirma el estado en la BD (un broadcast nunca decide por sí solo).
 */
@Component({
  selector: 'app-waiting-room',
  templateUrl: './waiting-room.page.html',
  styleUrls: ['./waiting-room.page.scss'],
  standalone: true,
  imports: [BotonGuiaComponent, TrPipe, TranslocoPipe, 
    IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader,
    IonIcon, IonItem, IonLabel, IonList, IonSpinner, IonTitle, IonToolbar, CommonModule
  ]
})
export class WaitingRoomPage implements OnDestroy {
  readonly MINIMO_CATADORES = MINIMO_CATADORES;
  readonly CATADORES_RECOMENDADOS = CATADORES_RECOMENDADOS;
  readonly EstadoSesion = EstadoSesion;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly sesionService = inject(SesionesRepository);
  private readonly realtimeService = inject(RealtimeService);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly modalController = inject(ModalController);
  private readonly transloco = inject(TranslocoService);

  readonly sesion = signal<Sesion | null>(null);
  readonly participantes = signal<Participante[]>([]);
  readonly nombresMuestras = signal<ReadonlyMap<number, string>>(new Map());
  readonly editando = signal(false);
  readonly cargando = signal(true);
  readonly iniciando = signal(false);
  readonly cambiandoListo = signal(false);
  readonly saliendo = signal(false);
  readonly copiado = signal(false);
  readonly error = signal<string | null>(null);

  private readonly sala = signal<SalaRealtime | null>(null);
  private readonly ahora = signal(Date.now());

  readonly usuarioActualId = computed(() => this.authService.usuario()?.id ?? null);
  readonly estadoConexion = computed(() => this.sala()?.estadoConexion() ?? 'desconectado');
  readonly sinConexion = computed(() => this.sala() !== null && this.estadoConexion() !== 'conectado');

  readonly esOrganizador = computed(() => {
    const uid = this.usuarioActualId();
    const sesion = this.sesion();
    return Boolean(uid && sesion && sesion.organizadorId === uid);
  });

  readonly miParticipacion = computed(() => {
    const uid = this.usuarioActualId();
    return uid ? this.participantes().find(p => p.usuarioId === uid) ?? null : null;
  });

  /** Participantes de la BD enriquecidos con su estado de Presence. */
  readonly participantesEnSala = computed<ParticipanteEnSala[]>(() => {
    const presencia = this.sala()?.presencia() ?? new Map();
    const uid = this.usuarioActualId();
    const ahora = this.ahora();

    return this.participantes().map(participante => {
      const registro = presencia.get(participante.usuarioId);
      let conexion: ConexionParticipante = 'desconectado';
      if (participante.usuarioId === uid && this.estadoConexion() === 'conectado') conexion = 'en_linea';
      else if (registro) conexion = registro.estado;

      const segundosGracia = conexion === 'inestable' && registro
        ? Math.max(0, Math.ceil((registro.desde + GRACE_PERIOD_MS - ahora) / 1000))
        : null;
      return { ...participante, conexion, segundosGracia };
    });
  });

  readonly participantesListos = computed(() => this.participantes().filter(p => p.listo).length);
  readonly faltanListos = computed(() => Math.max(0, MINIMO_CATADORES - this.participantesListos()));
  readonly puedeIniciar = computed(() => this.faltanListos() === 0 && !this.iniciando());
  /** Panel recomendado: al menos 3 listos y en número impar. */
  readonly panelRecomendado = computed(() => catadoresSonRecomendados(this.participantesListos()));
  readonly puedeEditar = computed(() => {
    const s = this.sesion();
    return this.esOrganizador() && s?.estado === EstadoSesion.EN_ESPERA && getFormatoById(s.formato).id !== 'extrinseca';
  });
  readonly tituloFormato = computed(() => {
    const s = this.sesion();
    return s ? getFormatoById(s.formato).titulo : '';
  });
  readonly listaNombresMuestras = computed(() =>
    [...this.nombresMuestras().entries()].sort(([a], [b]) => a - b).map(([numero, nombre]) => ({ numero, nombre }))
  );
  readonly organizadorParticipaComoCatador = computed(() => this.esOrganizador() && this.miParticipacion() !== null);
  readonly hayInestables = computed(() => this.participantesEnSala().some(p => p.conexion === 'inestable'));

  private sesionId = '';
  private eventosSub?: Subscription;
  private relojId?: ReturnType<typeof setInterval>;
  private sondeoId?: ReturnType<typeof setInterval>;
  private copiadoId?: ReturnType<typeof setTimeout>;
  private conectado = false;
  private redirigiendo = false;
  private version = 0;
  private resincronizacion = 0;

  constructor() {
    addIcons({
      checkmarkCircleOutline, cloudOfflineOutline, copyOutline, createOutline, exitOutline,
      lockClosedOutline, peopleOutline, refreshOutline, warningOutline
    });
  }

  ionViewWillEnter(): void {
    void this.conectar();
  }

  ionViewWillLeave(): void {
    this.desconectar();
  }

  ngOnDestroy(): void {
    this.desconectar();
    clearTimeout(this.copiadoId);
  }

  reintentar(): void {
    this.desconectar();
    void this.conectar();
  }

  private async conectar(): Promise<void> {
    if (this.conectado) return;
    this.conectado = true;
    const version = ++this.version;
    const vigente = () => this.conectado && version === this.version;

    // Reinicio completo: Ionic reutiliza la instancia de la página en caché.
    this.redirigiendo = false;
    this.sesion.set(null);
    this.participantes.set([]);
    this.nombresMuestras.set(new Map());
    this.error.set(null);
    this.iniciando.set(false);
    this.cargando.set(true);

    this.sesionId = this.route.snapshot.paramMap.get('sesionId')?.trim() ?? '';
    if (!this.sesionId) {
      this.fallar('No se especificó una sesión.');
      return;
    }

    try {
      await conTiempoLimite(this.authService.asegurarInicializado(), TIEMPO_MAXIMO_CARGA_MS);
      const usuario = this.authService.usuario();
      if (!vigente()) return;
      if (!usuario) throw new Error(this.transloco.translate('txt.debes_iniciar_sesion_para_ver_es_dfbyqh'));

      const [sesion, participantes, nombres] = await conTiempoLimite(
        Promise.all([
          this.sesionService.obtenerSesionPorId(this.sesionId),
          this.sesionService.obtenerParticipantes(this.sesionId),
          this.sesionService.obtenerNombresMuestras(this.sesionId)
        ]),
        TIEMPO_MAXIMO_CARGA_MS
      );
      if (!vigente()) return;
      if (!sesion) throw new Error(this.transloco.translate('txt.no_se_encontro_la_sesion_o_no_pe_1e33yn'));
      this.sesion.set(sesion);
      this.participantes.set(participantes);
      this.nombresMuestras.set(nombres);

      if (getFormatoById(sesion.formato).id === 'extrinseca') {
        await this.navegar(`/extrinsic-form/${sesion.id}`);
        return;
      }
      if (await this.redirigirSegunEstado(sesion)) return;

      const esOrganizador = sesion.organizadorId === usuario.id;
      if (!esOrganizador && !participantes.some(p => p.usuarioId === usuario.id)) {
        throw new Error(this.transloco.translate('txt.ya_no_formas_parte_de_esta_sesio_pyo0hz'));
      }

      const sala = this.realtimeService.abrirSala({
        sesionId: sesion.id,
        usuarioId: usuario.id,
        nombre: usuario.nombre,
        rol: esOrganizador ? 'organizador' : 'catador'
      });
      this.sala.set(sala);
      this.eventosSub = sala.eventos$.subscribe(evento => void this.manejarEvento(evento, version));

      this.relojId = setInterval(() => {
        if (this.hayInestables()) this.ahora.set(Date.now());
      }, 1000);
      this.sondeoId = setInterval(() => {
        if (this.sinConexion()) void this.resincronizar(version);
      }, SONDEO_SIN_SOCKET_MS);
    } catch (error) {
      if (vigente()) this.fallar(mensajeDeError(error, 'No se pudo cargar la sala de espera.'));
    } finally {
      if (version === this.version) this.cargando.set(false);
    }
  }

  private desconectar(): void {
    this.conectado = false;
    this.version++;
    this.eventosSub?.unsubscribe();
    this.eventosSub = undefined;
    clearInterval(this.relojId);
    clearInterval(this.sondeoId);
    const sala = this.sala();
    if (sala) this.realtimeService.liberarSala(sala);
    this.sala.set(null);
  }

  private fallar(mensaje: string): void {
    this.error.set(mensaje);
    this.cargando.set(false);
    this.conectado = false;
  }

  private async manejarEvento(evento: EventoSala, version: number): Promise<void> {
    if (version !== this.version) return;

    switch (evento.tipo) {
      case 'LISTO':
        this.participantes.update(lista =>
          lista.map(p => (p.usuarioId === evento.usuarioId ? { ...p, listo: evento.listo } : p))
        );
        break;
      case 'PARTICIPANTE_RETIRADO':
        if (evento.usuarioId === this.usuarioActualId()) {
          await this.expulsado();
          return;
        }
        this.participantes.update(lista => lista.filter(p => p.usuarioId !== evento.usuarioId));
        break;
      case 'INICIAR_CATA':
      case 'SESION_FINALIZADA':
      case 'RESYNC':
        await this.resincronizar(version);
        break;
      default:
        break;
    }
  }

  /** Recarga sesión + participantes desde la BD (fuente de verdad). */
  private async resincronizar(version: number): Promise<void> {
    const solicitud = ++this.resincronizacion;
    try {
      const [sesion, participantes, nombres] = await Promise.all([
        this.sesionService.obtenerSesionPorId(this.sesionId),
        this.sesionService.obtenerParticipantes(this.sesionId),
        this.sesionService.obtenerNombresMuestras(this.sesionId)
      ]);
      if (version !== this.version || solicitud !== this.resincronizacion) return;
      if (!sesion) {
        this.error.set('La sesión ya no está disponible.');
        return;
      }

      this.sesion.set(sesion);
      this.participantes.set(participantes);
      this.nombresMuestras.set(nombres);

      const uid = this.usuarioActualId();
      if (!this.esOrganizador() && uid && !participantes.some(p => p.usuarioId === uid)) {
        await this.expulsado();
        return;
      }
      await this.redirigirSegunEstado(sesion);
    } catch (error) {
      if (version === this.version) {
        console.warn('[WaitingRoom] Resincronización fallida:', error);
      }
    }
  }

  private async expulsado(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Saliste de la sesión (desconexión prolongada o retiro del organizador).',
      duration: 3500,
      color: 'warning'
    });
    await toast.present();
    await this.navegar('/dashboard');
  }

  async alternarListo(): Promise<void> {
    const yo = this.miParticipacion();
    const sala = this.sala();
    if (!yo || this.cambiandoListo()) return;

    const nuevoEstado = !yo.listo;
    this.cambiandoListo.set(true);
    this.error.set(null);
    this.participantes.update(lista =>
      lista.map(p => (p.usuarioId === yo.usuarioId ? { ...p, listo: nuevoEstado } : p))
    );

    try {
      await this.sesionService.marcarComoListo(this.sesionId, nuevoEstado);
      await sala?.enviar({ tipo: 'LISTO', usuarioId: yo.usuarioId, listo: nuevoEstado });
    } catch (error) {
      this.participantes.update(lista =>
        lista.map(p => (p.usuarioId === yo.usuarioId ? { ...p, listo: yo.listo } : p))
      );
      this.error.set(mensajeDeError(error, 'No se pudo actualizar tu estado.'));
    } finally {
      this.cambiandoListo.set(false);
    }
  }

  /** Abre el editor de la sesión (nombre, notas, formato, muestras, catadores). */
  async editarSesion(): Promise<void> {
    const sesion = this.sesion();
    if (!sesion || !this.puedeEditar() || this.editando()) return;

    this.editando.set(true);
    try {
      const modal = await this.modalController.create({
        component: EditarSesionModalComponent,
        componentProps: { sesion, nombresActuales: this.nombresMuestras() }
      });
      await modal.present();
      const { data, role } = await modal.onWillDismiss<ResultadoEdicionSesion>();
      if (role !== 'guardado' || !data) return;

      this.sesion.set(data.sesion);
      this.nombresMuestras.set(data.nombresMuestras);
      // Si cambió la participación del organizador, su fila en participantes también.
      this.participantes.set(await this.sesionService.obtenerParticipantes(this.sesionId));
      // Los demás reciben el cambio por postgres_changes (UPDATE de sesiones → RESYNC).
      const toast = await this.toastController.create({ message: 'Sesión actualizada.', duration: 2000, color: 'success' });
      await toast.present();
    } finally {
      this.editando.set(false);
    }
  }

  async iniciarCata(): Promise<void> {
    const sesion = this.sesion();
    if (!this.esOrganizador() || !sesion || !this.puedeIniciar()) return;

    if (!this.panelRecomendado()) {
      const alerta = await this.alertController.create({
        header: 'Panel fuera de lo recomendado',
        message: `Hay ${this.participantesListos()} catador(es) listo(s). Se recomienda un panel de al menos 3 catadores y en número impar (3, 5, 7…). ¿Iniciar de todos modos?`,
        buttons: [
          { text: 'Esperar', role: 'cancel' },
          { text: 'Iniciar', role: 'confirm' }
        ]
      });
      await alerta.present();
      const { role } = await alerta.onDidDismiss();
      if (role !== 'confirm') return;
    }

    this.iniciando.set(true);
    this.error.set(null);
    try {
      await this.sesionService.iniciarSesion(this.sesionId);
      await this.sala()?.enviar({ tipo: 'INICIAR_CATA' });
      const iniciada: Sesion = { ...sesion, estado: EstadoSesion.INICIADA };
      this.sesion.set(iniciada);
      await this.redirigirSegunEstado(iniciada);
    } catch (error) {
      const mensaje = mensajeDeError(error, 'No se pudo iniciar la cata.');
      this.error.set(mensaje);
      this.iniciando.set(false);
      // El aviso de arriba puede quedar fuera de la vista: también se muestra como toast.
      const toast = await this.toastController.create({ message: mensaje, duration: 4000, color: 'danger' });
      await toast.present();
    }
  }

  async salirDeSala(): Promise<void> {
    if (this.esOrganizador() || this.saliendo()) return;

    const alerta = await this.alertController.create({
      header: 'Salir de la sesión',
      message: 'Dejarás de figurar como catador. Podrás volver a unirte con el código mientras la cata no haya iniciado.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Salir', role: 'confirm' }
      ]
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'confirm') return;

    this.saliendo.set(true);
    try {
      await this.sesionService.abandonarSesion(this.sesionId);
      await this.navegar('/dashboard');
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo salir de la sesión.'));
    } finally {
      this.saliendo.set(false);
    }
  }

  async copiarCodigo(): Promise<void> {
    const codigo = this.sesion()?.codigoAcceso;
    if (!codigo) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigo);
      } else {
        await Clipboard.write({ string: codigo });
      }
      this.copiado.set(true);
      clearTimeout(this.copiadoId);
      this.copiadoId = setTimeout(() => this.copiado.set(false), 2000);
      const toast = await this.toastController.create({ message: '¡Código copiado!', duration: 2000, color: 'dark' });
      await toast.present();
    } catch {
      this.error.set(this.transloco.translate('txt.no_se_pudo_copiar_el_codigo_fj869g'));
    }
  }

  /** Devuelve true si inició una navegación fuera de la sala. */
  private async redirigirSegunEstado(sesion: Sesion): Promise<boolean> {
    switch (sesion.estado) {
      case EstadoSesion.INICIADA: {
        if (this.esOrganizador() && !sesion.organizadorParticipa) {
          return this.navegar(`/session/${sesion.id}/organizer-dashboard`);
        }
        const ruta = RUTAS_FORMULARIO[getFormatoById(sesion.formato).id];
        return this.navegar(`/${ruta}/${sesion.id}`);
      }
      case EstadoSesion.FINALIZADA:
        return this.navegar(this.esOrganizador()
          ? `/session/${sesion.id}/results`
          : `/session/${sesion.id}/evaluation-complete`);
      case EstadoSesion.CANCELADA:
        this.error.set('Esta sesión fue cancelada por el organizador.');
        return false;
      default:
        return false;
    }
  }

  private async navegar(url: string): Promise<boolean> {
    if (this.redirigiendo) return true;
    this.redirigiendo = true;
    try {
      const ok = await this.router.navigateByUrl(url, { replaceUrl: true });
      if (!ok) throw new Error('Navegación cancelada');
      return true;
    } catch {
      this.redirigiendo = false;
      this.error.set(this.transloco.translate('txt.no_se_pudo_abrir_la_pantalla_de_gqih7d'));
      return false;
    }
  }

  tiempoDesde(fechaIso?: string): string {
    if (!fechaIso) return 'Se unió ahora';
    const minutos = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 60000);
    if (minutos < 1) return 'Se unió ahora';
    if (minutos < 60) return `Se unió hace ${minutos} min`;
    return `Se unió hace ${Math.floor(minutos / 60)} h`;
  }
}
