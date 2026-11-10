import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController, IonButton, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle, cloudOfflineOutline, ellipseOutline, lockClosed, personCircleOutline, playForwardOutline
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { EventoSala, GRACE_PERIOD_MS, RealtimeService, SalaRealtime } from '../../../core/services/realtime';
import { ProgresoPanel, SesionService } from '../../../core/services/sesion';
import { mensajeDeError } from '../../../core/utils/errores';
import { ProgressTrackerComponent } from '../../../shared/components/progress-tracker/progress-tracker.component';

import { TranslocoPipe } from '@jsverse/transloco';
import { TrPipe } from '../../../core/i18n/tr';
const SONDEO_PROGRESO_MS = 30_000;
const SONDEO_SIN_SOCKET_MS = 8_000;

export type EstadoCelda = 'enviada' | 'pendiente' | 'cerrada';

export interface FilaCatador {
  usuarioId: string;
  nombre: string;
  esOrganizador: boolean;
  conexion: 'en_linea' | 'inestable' | 'desconectado';
  segundosGracia: number | null;
  celdas: EstadoCelda[];
  enviadas: number;
  terminado: boolean;
}

/**
 * Sala de control del organizador (sin puntajes: evaluación ciega).
 *  · Progreso: RPC get_progreso_panel (fichas enviadas por catador y muestra).
 *  · Tiempo real: EVALUACION_ENVIADA (broadcast) → refresco inmediato;
 *    sondeo lento como respaldo.
 *  · Desbloqueos: forzar_cierre_muestra y finalizar_sesion_forzado.
 *  · Guía del panel: CAMBIAR_MUESTRA lleva a todos a la muestra indicada.
 *  · El Grace Period de Presence lo ejecuta la SalaRealtime de este cliente.
 */
@Component({
  selector: 'app-organizer-dashboard',
  templateUrl: './organizer-dashboard.page.html',
  styleUrls: ['./organizer-dashboard.page.scss'],
  standalone: true,
  imports: [TranslocoPipe, TrPipe, 
    IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonButton, IonSpinner,
    CommonModule, ProgressTrackerComponent
  ]
})
export class OrganizerDashboardPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly sesionService = inject(SesionService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly nombreSesion = signal('');
  readonly progreso = signal<ProgresoPanel | null>(null);
  readonly cargando = signal(true);
  readonly accionEnCurso = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly muestraGuiada = signal(1);

  private readonly sala = signal<SalaRealtime | null>(null);
  private readonly ahora = signal(Date.now());

  readonly sinConexion = computed(() => {
    const sala = this.sala();
    return sala !== null && sala.estadoConexion() !== 'conectado';
  });

  readonly numeroMuestras = computed(() => this.progreso()?.numeroMuestras ?? 0);
  readonly muestras = computed(() => Array.from({ length: this.numeroMuestras() }, (_, i) => i + 1));
  readonly panelCerrado = computed(() => this.progreso()?.estado === 'completada');
  readonly panelEnProgreso = computed(() => this.progreso()?.estado === 'en_progreso');

  readonly filas = computed<FilaCatador[]>(() => {
    const progreso = this.progreso();
    if (!progreso) return [];
    const cerradas = new Set(progreso.muestrasCerradas);
    const presencia = this.sala()?.presencia() ?? new Map();
    const ahora = this.ahora();

    return progreso.catadores.map(catador => {
      const enviadas = new Set(catador.muestrasEnviadas);
      const celdas = this.muestras().map<EstadoCelda>(n =>
        enviadas.has(n) ? 'enviada' : cerradas.has(n) ? 'cerrada' : 'pendiente'
      );
      const registro = presencia.get(catador.usuarioId);
      const conexion = registro?.estado ?? 'desconectado';
      return {
        usuarioId: catador.usuarioId,
        nombre: catador.nombre,
        esOrganizador: catador.esOrganizador,
        conexion,
        segundosGracia: conexion === 'inestable' && registro
          ? Math.max(0, Math.ceil((registro.desde + GRACE_PERIOD_MS - ahora) / 1000))
          : null,
        celdas,
        enviadas: enviadas.size,
        terminado: celdas.every(c => c !== 'pendiente')
      };
    });
  });

  readonly terminados = computed(() => this.filas().filter(f => f.terminado).length);

  /** Por muestra: cuántas fichas faltan (para habilitar "Cerrar muestra"). */
  readonly pendientesPorMuestra = computed(() =>
    this.muestras().map((n, indice) => ({
      numero: n,
      pendientes: this.filas().filter(f => f.celdas[indice] === 'pendiente').length,
      cerrada: this.progreso()?.muestrasCerradas.includes(n) ?? false
    }))
  );

  private sesionId = '';
  private eventosSub?: Subscription;
  private sondeoId?: ReturnType<typeof setInterval>;
  private sondeoRapidoId?: ReturnType<typeof setInterval>;
  private relojId?: ReturnType<typeof setInterval>;
  private activo = false;

  constructor() {
    addIcons({ checkmarkCircle, cloudOfflineOutline, ellipseOutline, lockClosed, personCircleOutline, playForwardOutline });
  }

  ionViewWillEnter(): void {
    void this.conectar();
  }

  ionViewWillLeave(): void {
    this.desconectar();
  }

  ngOnDestroy(): void {
    this.desconectar();
  }

  private async conectar(): Promise<void> {
    if (this.activo) return;
    this.activo = true;
    this.cargando.set(true);
    this.error.set(null);
    this.progreso.set(null);

    this.sesionId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!this.sesionId) {
      this.error.set('No se encontró el ID de la sesión.');
      this.cargando.set(false);
      return;
    }

    try {
      await this.authService.asegurarInicializado();
      const usuario = this.authService.usuario();
      if (!usuario) throw new Error('Debes iniciar sesión.');

      const sesion = await this.sesionService.obtenerSesionPorId(this.sesionId);
      if (!this.activo) return;
      if (!sesion) throw new Error('No se encontró la sesión.');
      this.nombreSesion.set(sesion.nombre);

      await this.actualizarProgreso();
      if (!this.activo) return;

      const sala = this.realtimeService.abrirSala({
        sesionId: this.sesionId,
        usuarioId: usuario.id,
        nombre: usuario.nombre,
        rol: 'organizador'
      });
      this.sala.set(sala);
      this.eventosSub = sala.eventos$.subscribe(evento => void this.manejarEvento(evento));

      this.sondeoId = setInterval(() => void this.actualizarProgreso(), SONDEO_PROGRESO_MS);
      this.sondeoRapidoId = setInterval(() => {
        if (this.sinConexion()) void this.actualizarProgreso();
      }, SONDEO_SIN_SOCKET_MS);
      this.relojId = setInterval(() => {
        if (this.filas().some(f => f.conexion === 'inestable')) this.ahora.set(Date.now());
      }, 1000);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo cargar el panel.'));
    } finally {
      this.cargando.set(false);
    }
  }

  private desconectar(): void {
    this.activo = false;
    this.eventosSub?.unsubscribe();
    this.eventosSub = undefined;
    clearInterval(this.sondeoId);
    clearInterval(this.sondeoRapidoId);
    clearInterval(this.relojId);
    const sala = this.sala();
    if (sala) this.realtimeService.liberarSala(sala);
    this.sala.set(null);
  }

  private async manejarEvento(evento: EventoSala): Promise<void> {
    switch (evento.tipo) {
      case 'EVALUACION_ENVIADA':
      case 'PARTICIPANTE_RETIRADO':
      case 'RESYNC':
        await this.actualizarProgreso();
        break;
      default:
        break;
    }
  }

  private async actualizarProgreso(): Promise<void> {
    if (!this.activo) return;
    try {
      const progreso = await this.sesionService.obtenerProgresoPanel(this.sesionId);
      if (!this.activo) return;
      this.progreso.set(progreso);
      this.error.set(null);
    } catch (error) {
      console.error('No se pudo actualizar el progreso del panel:', error);
      this.error.set(mensajeDeError(error, 'No se pudo actualizar el progreso.'));
    }
  }

  async guiarPanel(delta: number): Promise<void> {
    const total = this.numeroMuestras();
    if (total === 0 || this.accionEnCurso()) return;
    const destino = Math.min(total, Math.max(1, this.muestraGuiada() + delta));
    this.muestraGuiada.set(destino);
    const ok = await this.sala()?.enviar({ tipo: 'CAMBIAR_MUESTRA', numeroMuestra: destino });
    await this.toast(ok ? `Panel guiado a la muestra ${destino}.` : 'Sin conexión: no se pudo avisar al panel.', ok ? 'dark' : 'warning');
  }

  async forzarCierreMuestra(numeroMuestra: number, pendientes: number): Promise<void> {
    if (this.accionEnCurso()) return;
    const confirmado = await this.confirmar(
      `Cerrar muestra ${numeroMuestra}`,
      `${pendientes} ficha(s) pendiente(s) de esta muestra no se aceptarán y no contarán en el consolidado.`,
      'Cerrar muestra'
    );
    if (!confirmado) return;

    this.accionEnCurso.set(`muestra-${numeroMuestra}`);
    try {
      const resultado = await this.sesionService.forzarCierreMuestra(this.sesionId, numeroMuestra);
      await this.sala()?.enviar({ tipo: 'MUESTRA_CERRADA', numeroMuestra });
      if (resultado.sesionCompletada) {
        await this.sala()?.enviar({ tipo: 'SESION_FINALIZADA' });
        await this.irAResultados();
        return;
      }
      await this.actualizarProgreso();
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo cerrar la muestra.'));
    } finally {
      this.accionEnCurso.set(null);
    }
  }

  async finalizarSesion(): Promise<void> {
    if (this.panelCerrado()) {
      await this.irAResultados();
      return;
    }
    if (this.accionEnCurso()) return;

    const pendientes = this.filas().filter(f => !f.terminado).length;
    const confirmado = await this.confirmar(
      'Finalizar panel',
      pendientes > 0
        ? `Hay ${pendientes} catador(es) con fichas pendientes. Se cerrarán todas las muestras y no se aceptarán más envíos.`
        : 'Se cerrará el panel y se calcularán los resultados.',
      'Finalizar y ver resultados'
    );
    if (!confirmado) return;

    this.accionEnCurso.set('finalizar');
    try {
      await this.sesionService.finalizarSesionForzado(
        this.sesionId,
        pendientes > 0 ? `Finalizado por el organizador con ${pendientes} catador(es) pendiente(s)` : undefined
      );
      await this.sala()?.enviar({ tipo: 'SESION_FINALIZADA' });
      await this.irAResultados();
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo finalizar el panel.'));
    } finally {
      this.accionEnCurso.set(null);
    }
  }

  private async confirmar(header: string, message: string, textoConfirmar: string): Promise<boolean> {
    const alerta = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: textoConfirmar, role: 'confirm' }
      ]
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    return role === 'confirm';
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    await toast.present();
  }

  private async irAResultados(): Promise<void> {
    await this.router.navigateByUrl(`/session/${this.sesionId}/results`, { replaceUrl: true });
  }
}
