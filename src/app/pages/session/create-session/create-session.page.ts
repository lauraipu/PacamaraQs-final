import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonRange,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, informationCircleOutline } from 'ionicons/icons';
import { EstadoSesion, FormatoCva, Sesion } from '../../../core/models/sesion.model';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';
addIcons({ checkmarkCircle, informationCircleOutline });

@Component({
  selector: 'app-create-session',
  templateUrl: './create-session.page.html',
  styleUrls: ['./create-session.page.scss'],
  standalone: true,
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonRange,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar,
    CommonModule,
    FormsModule,
    RouterLink
  ]
})



export class CreateSessionPage {
  pasoActual = 1;
  nombreSesion = '';
  notasSesion = '';
  formatoSeleccionado: string = FormatoCva.COMBINADO.id;
  numeroMuestras = 6;
  catadoresObjetivo = 5;
  participaComoCatador = true;
  codigoGenerado = '';
  sesionIdGenerado = '';
  copiado = false;
  isLoading = false;
  isCopying = false;
  error: string | null = null;
  private organizadorId = '';
  private organizadorNombre = 'Organizador';
  organizadorPendiente = false;

  readonly formatosList = [
    {
      ...FormatoCva.COMBINADO,
      desc: 'Evalúa intensidad física (1–15) y calidad hedónica (1–9) simultáneamente.',
      tag: 'Intensidad + Calidad'
    },
    {
      ...FormatoCva.AFECTIVO,
      desc: 'Solo calidad hedónica (1–9). Mide preferencia y agrado del consumidor.',
      tag: 'Solo Calidad'
    },
    {
      ...FormatoCva.DESCRIPTIVO,
      desc: 'Solo intensidad física (1–15). Perfil sensorial objetivo sin juicio de calidad.',
      tag: 'Solo Intensidad'
    },
    {
      ...FormatoCva.EXTRINSECA,
      desc: 'Evaluación de atributos externos: origen, presentación, empaque, precio percibido.',
      tag: 'Atributos externos'
    }
  ];

  private readonly sesionService = inject(SesionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly toastController = inject(ToastController);

  getTituloFormato(): string {
    return this.formatosList.find(formato => formato.id === this.formatoSeleccionado)?.titulo ?? '';
  }

  async generarCodigo(): Promise<void> {
    if (!this.nombreSesion.trim()) {
      this.error = 'El nombre de la sesión no puede estar vacío.';
      return;
    }

    this.isLoading = true;
    this.error = null;
    try {
      const { user } = await this.authService.getUser();
      if (!user) throw new Error('Debes iniciar sesión para crear una sesión.');

      this.organizadorId = user.id;
      const metadataNombre = user.user_metadata['nombre'];
      this.organizadorNombre = typeof metadataNombre === 'string' && metadataNombre.trim()
        ? metadataNombre.trim()
        : user.email ?? 'Organizador';

      const esExtrinseco = this.formatoSeleccionado === FormatoCva.EXTRINSECA.id;
      const nuevaSesion: Sesion = {
        id: '',
        codigoAcceso: '',
        nombre: this.nombreSesion.trim(),
        notas: this.notasSesion.trim(),
        formato: this.formatoSeleccionado,
        numeroMuestras: esExtrinseco ? 1 : this.numeroMuestras,
        catadoresObjetivo: esExtrinseco ? 3 : this.catadoresObjetivo,
        organizadorId: user.id,
        organizadorParticipa: esExtrinseco ? false : this.participaComoCatador,
        estado: EstadoSesion.EN_ESPERA
      };

      const creada = await this.sesionService.crearSesion(nuevaSesion);
      this.codigoGenerado = creada.codigoAcceso;
      this.sesionIdGenerado = creada.id;
      this.pasoActual = 2;
      this.changeDetector.detectChanges();

      if (nuevaSesion.organizadorParticipa) {
        this.organizadorPendiente = true;
        try {
          await this.registrarOrganizador();
        } catch (error) {
          console.error('ERROR COMPLETO DE SUPABASE:', error);
          this.error = `La sesión se creó, pero no se pudo agregar al organizador como catador. ${this.mensajeError(error)}`;
        }
      }
    } catch (error) {
      console.error('ERROR COMPLETO DE SUPABASE:', error);
      this.error = this.mensajeError(error);
    } finally {
      this.isLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  async reintentarRegistroOrganizador(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      await this.registrarOrganizador();
    } catch (error) {
      this.error = `No se pudo agregar al organizador como catador. ${this.mensajeError(error)}`;
    } finally {
      this.isLoading = false;
    }
  }

  async copiarCodigo(): Promise<void> {
    this.isCopying = true;
    this.error = null;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.codigoGenerado);
      } else {
        await Clipboard.write({ string: this.codigoGenerado });
      }
      this.copiado = true;
      window.setTimeout(() => this.copiado = false, 2000);
      const toast = await this.toastController.create({
        message: '¡Código copiado!',
        duration: 2000,
        color: 'dark'
      });
      await toast.present();
    } catch (error) {
      this.error = this.mensajeError(error);
      const toast = await this.toastController.create({
        message: `No se pudo copiar el código. ${this.mensajeError(error)}`,
        duration: 3500,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.isCopying = false;
    }
  }

  async irASalaDeEspera(): Promise<void> {
    if (this.organizadorPendiente) {
      this.error = 'Agrega al organizador a la sesión antes de continuar.';
      return;
    }

    if (this.formatoSeleccionado === FormatoCva.EXTRINSECA.id) {
      await this.router.navigate(['/extrinsic-form', this.sesionIdGenerado]);
      return;
    }

    await this.router.navigate(['/session/waiting', this.sesionIdGenerado]);
  }

  private async registrarOrganizador(): Promise<void> {
    await this.sesionService.insertarParticipanteDirecto(
      this.sesionIdGenerado,
      this.organizadorId,
      this.organizadorNombre,
      true
    );
    this.organizadorPendiente = false;
  }

  private mensajeError(error: unknown): string {
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  }
}
