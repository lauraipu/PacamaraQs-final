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
import { checkmarkCircle, informationCircleOutline, warningOutline } from 'ionicons/icons';
import { catadoresSonRecomendados, EstadoSesion, FormatoCva, normalizarNombresMuestras, Sesion } from '@domain/sesion/sesion.model';
import { NombresMuestrasComponent } from '../../ui/nombres-muestras/nombres-muestras.component';
import { AuthService } from '@core/auth/auth.service';
import { SesionesRepository } from '@core/data-access/sesiones/sesiones.repository';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TrPipe } from '@core/i18n/tr';
addIcons({ checkmarkCircle, informationCircleOutline, warningOutline });

const RUTAS_FORMULARIO: Readonly<Record<string, string>> = {
  combinado: 'combined-form',
  afectivo: 'affective-form',
  descriptivo: 'descriptive-form'
};

@Component({
  selector: 'app-create-session',
  templateUrl: './create-session.page.html',
  styleUrls: ['./create-session.page.scss'],
  standalone: true,
  imports: [TrPipe, TranslocoPipe, NombresMuestrasComponent,
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
  /** Nombre opcional de cada muestra (índice 0 = muestra 1). */
  nombresMuestras: string[] = Array.from({ length: 20 }, () => '');
  codigoGenerado = '';
  sesionIdGenerado = '';
  copiado = false;
  isLoading = false;
  isCopying = false;
  error: string | null = null;

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

  private readonly sesionService = inject(SesionesRepository);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly toastController = inject(ToastController);
  private readonly transloco = inject(TranslocoService);

  /** 3 o más e impar: se recomienda, pero se puede iniciar desde 1. */
  catadoresRecomendados(): boolean {
    return catadoresSonRecomendados(this.catadoresObjetivo);
  }

  nombresConfigurados(): string[] {
    return normalizarNombresMuestras(this.nombresMuestras, this.numeroMuestras).filter(n => n);
  }

  /**
   * Un solo catador y es el propio organizador: no hay a quién esperar, así
   * que la cata se inicia al crearla y se abre el formulario directamente.
   */
  esCataIndividual(): boolean {
    return this.formatoSeleccionado !== FormatoCva.EXTRINSECA.id
      && this.catadoresObjetivo === 1
      && this.participaComoCatador;
  }

  getTituloFormato(): string {
    return this.formatosList.find(formato => formato.id === this.formatoSeleccionado)?.titulo ?? '';
  }

  async generarCodigo(): Promise<void> {
    if (!this.nombreSesion.trim()) {
      this.error = this.transloco.translate('el_nombre_de_la_sesion_no_puede_1pjfpgj');
      return;
    }

    this.isLoading = true;
    this.error = null;
    try {
      const { user } = await this.authService.getUser();
      if (!user) throw new Error('Debes iniciar sesión para crear una sesión.');

      const esExtrinseco = this.formatoSeleccionado === FormatoCva.EXTRINSECA.id;
      const nuevaSesion: Sesion = {
        id: '',
        codigoAcceso: '',
        nombre: this.nombreSesion.trim(),
        notas: this.notasSesion.trim(),
        formato: this.formatoSeleccionado,
        numeroMuestras: esExtrinseco ? 1 : this.numeroMuestras,
        catadoresObjetivo: esExtrinseco ? 1 : this.catadoresObjetivo,
        organizadorId: user.id, // informativo: el servidor usa auth.uid()
        organizadorParticipa: esExtrinseco ? false : this.participaComoCatador,
        estado: EstadoSesion.EN_ESPERA,
        nombresMuestras: esExtrinseco ? [] : normalizarNombresMuestras(this.nombresMuestras, this.numeroMuestras)
      };

      const creada = await this.sesionService.crearSesion(nuevaSesion);
      this.codigoGenerado = creada.codigoAcceso;
      this.sesionIdGenerado = creada.id;

      if (!esExtrinseco && this.esCataIndividual() && await this.iniciarCataIndividual(creada)) return;
      this.pasoActual = 2;
      this.changeDetector.detectChanges();

      // crear_sesion() (RPC) ya registró al organizador como participante
      // en la misma transacción: no hay estado intermedio "sesión sin organizador".
    } catch (error) {
      console.error('ERROR COMPLETO DE SUPABASE:', error);
      this.error = this.mensajeError(error);
    } finally {
      this.isLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  /** Devuelve true si la cata quedó iniciada y se abrió el formulario. */
  private async iniciarCataIndividual(sesion: Sesion): Promise<boolean> {
    try {
      await this.sesionService.iniciarSesion(sesion.id);
      const ruta = RUTAS_FORMULARIO[sesion.formato] ?? RUTAS_FORMULARIO['combinado'];
      return await this.router.navigateByUrl(`/${ruta}/${sesion.id}`, { replaceUrl: true });
    } catch (error) {
      // La sesión ya existe: se sigue al paso 2 y se puede iniciar desde la sala de espera.
      console.warn('[CrearSesion] No se pudo iniciar la cata individual:', error);
      this.error = this.mensajeError(error);
      return false;
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
      // Zoneless: un setTimeout no dispara detección de cambios por sí solo.
      window.setTimeout(() => {
        this.copiado = false;
        this.changeDetector.markForCheck();
      }, 2000);
      const toast = await this.toastController.create({
        message: this.transloco.translate('txt.codigo_copiado_f5fksp'),
        duration: 2000,
        color: 'dark'
      });
      await toast.present();
    } catch (error) {
      this.error = this.mensajeError(error);
      const toast = await this.toastController.create({
        message: this.transloco.translate('txt.no_se_pudo_copiar_el_codigo_p0_v6ndnc', { p0: this.mensajeError(error) }),
        duration: 3500,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.isCopying = false;
      this.changeDetector.markForCheck();
    }
  }

  async irASalaDeEspera(): Promise<void> {
    const ruta = this.formatoSeleccionado === FormatoCva.EXTRINSECA.id
      ? `/extrinsic-form/${this.sesionIdGenerado}`
      : `/session/waiting/${this.sesionIdGenerado}`;
    await this.router.navigateByUrl(ruta, { replaceUrl: true });
  }

  private mensajeError(error: unknown): string {
    return error instanceof Error ? error.message : this.transloco.translate('txt.ocurrio_un_error_inesperado_ps7ccd');
  }
}
