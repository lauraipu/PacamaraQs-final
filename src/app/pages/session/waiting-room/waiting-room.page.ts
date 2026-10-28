import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { copyOutline, lockClosedOutline, peopleOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { EstadoSesion, getFormatoById, Participante, Sesion } from '../../../core/models/sesion.model';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';

@Component({
  selector: 'app-waiting-room',
  templateUrl: './waiting-room.page.html',
  styleUrls: ['./waiting-room.page.scss'],
  standalone: true,
  imports: [
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonTitle,
    IonToolbar,
    CommonModule
  ]
})
export class WaitingRoomPage implements OnInit, OnDestroy {
  sesionId = '';
  sesion: Sesion | null = null;
  usuarioActualId: string | null = null;
  esOrganizador = false;
  participantes: Participante[] = [];
  cargando = true;
  iniciando = false;
  copiando = false;
  copiado = false;
  error: string | null = null;
  private participantesSubscription?: Subscription;
  private sesionSubscription?: Subscription;
  private redirigiendo = false;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly sesionService = inject(SesionService);
  private readonly toastController = inject(ToastController);
  private readonly changeDetector = inject(ChangeDetectorRef);

  constructor() {
    addIcons({ copyOutline, lockClosedOutline, peopleOutline });
  }

  get puedeIniciar(): boolean {
    return this.participantes.length >= 3 && !this.iniciando;
  }

  async ngOnInit(): Promise<void> {
    this.sesionId = this.route.snapshot.paramMap.get('sesionId')?.trim() ?? '';
    if (!this.sesionId) {
      this.error = 'No se especificó una sesión.';
      this.cargando = false;
      this.changeDetector.detectChanges();
      return;
    }

    this.cargando = true;
    this.error = null;

    // 1. Obtener el usuario autenticado actual
    await this.obtenerUsuarioActual();

    // 2. Cargar datos de la sesión
    await this.cargarSesion();
    if (!this.sesion) {
      this.cargando = false;
      this.changeDetector.detectChanges();
      return;
    }

    // 3. Suscribirse a la lista de participantes en tiempo real
    this.participantesSubscription = this.sesionService
      .observarParticipantes(this.sesionId)
      .subscribe({
        next: participantes => {
          this.participantes = participantes;
          this.cargando = false;
          this.verificarSiEsOrganizador();
          this.changeDetector.detectChanges();
        },
        error: error => {
          console.error('Error al observar participantes:', error);
          if (this.participantes.length === 0) {
            this.error = 'No se pudo sincronizar la lista de participantes.';
          }
          this.cargando = false;
          this.changeDetector.detectChanges();
        }
      });

    this.sesionSubscription = this.sesionService
      .observarSesion(this.sesionId)
      .subscribe({
        next: sesionActualizada => {
          this.sesion = sesionActualizada;
          if (sesionActualizada.estado === EstadoSesion.INICIADA) {
            void this.redirigirAFormulario(sesionActualizada);
          }
        },
        error: error => {
          console.error('Error al observar el estado de la sesión:', error);
          this.error = 'No se pudo sincronizar el estado de la sesión.';
          this.changeDetector.detectChanges();
        }
      });

    if (this.sesion.estado === EstadoSesion.INICIADA) {
      void this.redirigirAFormulario(this.sesion);
    }
  }

  ngOnDestroy(): void {
    this.participantesSubscription?.unsubscribe();
    this.sesionSubscription?.unsubscribe();
  }

  async copiarCodigo(): Promise<void> {
    const codigo = this.sesion?.codigoAcceso;
    if (!codigo) {
      this.error = 'No hay un código de sesión para copiar.';
      return;
    }

    this.copiando = true;
    this.error = null;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigo);
      } else {
        await Clipboard.write({ string: codigo });
      }
      this.copiado = true;
      window.setTimeout(() => (this.copiado = false), 2000);
      const toast = await this.toastController.create({
        message: '¡Código copiado!',
        duration: 2000,
        color: 'dark'
      });
      await toast.present();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo copiar el código.';
      const toast = await this.toastController.create({
        message: `No se pudo copiar el código. ${this.error}`,
        duration: 3500,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.copiando = false;
      this.changeDetector.detectChanges();
    }
  }

  async iniciarCata(): Promise<void> {
    if (!this.esOrganizador || !this.sesion || !this.puedeIniciar) {
      return;
    }

    this.iniciando = true;
    this.error = null;
    this.changeDetector.detectChanges();

    try {
      await this.sesionService.iniciarSesion(this.sesionId);
      await this.redirigirAFormulario(this.sesion);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo iniciar la cata.';
    } finally {
      this.iniciando = false;
      this.changeDetector.detectChanges();
    }
  }

  private async obtenerUsuarioActual(): Promise<void> {
    try {
      const { user } = await this.authService.getUser();
      this.usuarioActualId = user?.id ?? null;
    } catch (error) {
      console.warn('No se pudo obtener el usuario de Supabase Auth:', error);
    }
  }

  private async cargarSesion(): Promise<void> {
    try {
      this.sesion = await this.sesionService.obtenerSesionPorId(this.sesionId);
      if (!this.sesion) {
        this.error = 'No se encontró la sesión solicitada.';
        return;
      }
      this.verificarSiEsOrganizador();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo cargar la sesión.';
    } finally {
      this.cargando = false;
      this.changeDetector.detectChanges();
    }
  }

  private verificarSiEsOrganizador(): void {
    if (!this.usuarioActualId) {
      return;
    }
    const idActual = this.usuarioActualId.trim().toLowerCase();

    // 1. Verificación por la tabla de sesiones (organizador_id)
    const esPorSesion = Boolean(
      this.sesion?.organizadorId &&
      this.sesion.organizadorId.trim().toLowerCase() === idActual
    );

    // 2. Verificación por la lista de participantes (es_organizador)
    const esPorParticipante = this.participantes.some(
      p => p.usuarioId && p.usuarioId.trim().toLowerCase() === idActual && p.esOrganizador
    );

    this.esOrganizador = esPorSesion || esPorParticipante;
  }

  private async redirigirAFormulario(sesion: Sesion): Promise<void> {
    if (this.redirigiendo) return;

    const formatoId = getFormatoById(sesion.formato).id;
    const rutasFormato: Record<string, string> = {
      combinado: 'combined-form',
      afectivo: 'affective-form',
      descriptivo: 'descriptive-form',
      extrinseca: 'extrinsic-form'
    };

    this.redirigiendo = true;
    try {
      await this.router.navigateByUrl(
        `/${rutasFormato[formatoId]}/${sesion.id}`,
        { replaceUrl: true }
      );
    } catch (error) {
      this.redirigiendo = false;
      this.error = error instanceof Error ? error.message : 'No se pudo abrir el formulario de cata.';
      this.changeDetector.detectChanges();
    }
  }
}
