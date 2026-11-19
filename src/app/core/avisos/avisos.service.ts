import { inject, Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { claveDeError } from './mensaje-error';

addIcons({ closeOutline });

export interface OpcionesConfirmar {
  titulo: string;
  mensaje: string;
  confirmar: string;
  cancelar?: string;
  /** Acción que no se puede deshacer: el botón se muestra en rojo. */
  peligro?: boolean;
  params?: Record<string, unknown>;
}

/**
 * Avisos de toda la app con un solo estilo: toasts de éxito / error / info y
 * confirmaciones. Recibe claves de traducción (o textos ya traducidos).
 */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly toasts = inject(ToastController);
  private readonly alertas = inject(AlertController);
  private readonly transloco = inject(TranslocoService);

  exito(clave: string, params?: Record<string, unknown>): Promise<void> {
    return this.toast(this.t(clave, params), 'success');
  }

  info(clave: string, params?: Record<string, unknown>): Promise<void> {
    return this.toast(this.t(clave, params), 'medium');
  }

  /** Recibe un error de Supabase/red o una clave, y muestra un mensaje claro. */
  error(errorOClave: unknown, params?: Record<string, unknown>): Promise<void> {
    const clave = typeof errorOClave === 'string' ? errorOClave : claveDeError(errorOClave);
    if (typeof errorOClave !== 'string') console.error('[Avisos]', errorOClave);
    return this.toast(this.t(clave, params), 'danger');
  }

  async confirmar(opciones: OpcionesConfirmar): Promise<boolean> {
    const alerta = await this.alertas.create({
      header: this.t(opciones.titulo, opciones.params),
      message: this.t(opciones.mensaje, opciones.params),
      buttons: [
        { text: this.t(opciones.cancelar ?? 'comun.confirmar_salida.cancelar'), role: 'cancel' },
        {
          text: this.t(opciones.confirmar, opciones.params),
          role: 'confirm',
          cssClass: opciones.peligro ? 'alerta-boton-peligro' : undefined
        }
      ]
    });
    await alerta.present();
    return (await alerta.onDidDismiss()).role === 'confirm';
  }

  private t(clave: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(clave, params);
  }

  private async toast(message: string, color: 'success' | 'danger' | 'medium'): Promise<void> {
    const toast = await this.toasts.create({
      message,
      color,
      duration: color === 'danger' ? 4000 : 2500,
      position: 'bottom',
      buttons: [{ icon: 'close-outline', role: 'cancel', side: 'end' }]
    });
    await toast.present();
  }
}
