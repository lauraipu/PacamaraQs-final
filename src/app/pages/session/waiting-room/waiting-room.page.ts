import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import {
  AlertController, IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader,
  IonIcon, IonItem, IonLabel, IonList, IonSpinner, IonTitle, IonToolbar, ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, cloudOfflineOutline, copyOutline, exitOutline, lockClosedOutline,
  peopleOutline, refreshOutline
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { EstadoSesion, getFormatoById, Participante, Sesion } from '../../../core/models/sesion.model';
import { AuthService } from '../../../core/services/auth';
import { EventoSala, GRACE_PERIOD_MS, RealtimeService, SalaRealtime } from '../../../core/services/realtime';
import { SesionService } from '../../../core/services/sesion';
import { mensajeDeError } from '../../../core/utils/errores';

const MINIMO_CATADORES = 3;
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
  imports: [
    IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader,
    IonIcon, IonItem, IonLabel, IonList, IonSpinner, IonTitle, IonToolbar, CommonModule
  ]
})
export class WaitingRoomPage implements OnDestroy {
  readonly MINIMO_CATADORES = MINIMO_CATADORES;
  readonly EstadoSesion = EstadoSesion;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly sesionService = inject(SesionService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);

  readonly sesion = signal<Sesion | null>(null);
  readonly participantes = signal<Participante[]>([]);
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

  constructor() {
    addIcons({
      checkmarkCircleOutline, cloudOfflineOutline, copyOutline, exitOutline,
      lockClosedOutline, peopleOutline, refreshOutline
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
      if (!usuario) throw new Error('Debes iniciar sesión para ver esta sesión.');

      const [sesion, participantes] = await conTiempoLimite(
        Promise.all([
          this.sesionService.obtenerSesionPorId(this.sesionId),
          this.sesionService.obtenerParticipantes(this.sesionId)
        ]),
        TIEMPO_MAXIMO_CARGA_MS
      );
      if (!vigente()) return;
      if (!sesion) throw new Error('No se encontró la sesión o no perteneces a ella.');
      this.sesion.set(sesion);
      this.participantes.set(participantes);

      if (getFormatoById(sesion.formato).id === 'extrinseca') {
        await this.navegar(`/extrinsic-form/${sesion.id}`);
        return;
      }
      if (await this.redirigirSegunEstado(sesion)) return;

      const esOrganizador = sesion.organizadorId === usuario.id;
      if (!esOrganizador && !participantes.some(p => p.usuarioId === usuario.id)) {
        throw new Error('Ya no formas parte de esta sesión.');
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
    try {
      const [sesion, participantes] = await Promise.all([
        this.sesionService.obtenerSesionPorId(this.sesionId),
        this.sesionService.obtenerParticipantes(this.sesionId)
      ]);
      if (version !== this.version) return;
      if (!sesion) {
        this.error.set('La sesión ya no está disponible.');
        return;
      }

      this.sesion.set(sesion);
      this.participantes.set(participantes);

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

  async iniciarCata(): Promise<void> {
    const sesion = this.sesion();
    if (!this.esOrganizador() || !sesion || !this.puedeIniciar()) return;

    this.iniciando.set(true);
    this.error.set(null);
    try {
      await this.sesionService.iniciarSesion(this.sesionId);
      await this.sala()?.enviar({ tipo: 'INICIAR_CATA' });
      const iniciada: Sesion = { ...sesion, estado: EstadoSesion.INICIADA };
      this.sesion.set(iniciada);
      await this.redirigirSegunEstado(iniciada);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo iniciar la cata.'));
      this.iniciando.set(false);
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
      this.error.set('No se pudo copiar el código.');
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
      this.error.set('No se pudo abrir la pantalla de la sesión.');
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
