import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonSpinner, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { mailOutline } from 'ionicons/icons';
import { AuthService } from '@core/auth/auth.service';
import { codigoDeError, esSinConexion, estadoHttp } from '@core/errores/errores';
import { SelectorIdiomaComponent } from '../../../shared/components/selector-idioma/selector-idioma.component';

addIcons({ mailOutline });

const ESPERA_REENVIO_S = 60;
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Olvidé mi contraseña": pide el enlace de recuperación a Supabase.
 * Siempre muestra el mismo mensaje, exista o no la cuenta, para no revelar
 * qué correos están registrados.
 */
@Component({
  selector: 'app-recuperar',
  templateUrl: './recuperar.page.html',
  styleUrls: ['./recuperar.page.scss'],
  standalone: true,
  imports: [IonContent, IonInput, IonButton, IonSpinner, IonIcon, FormsModule, RouterLink, TranslocoPipe, SelectorIdiomaComponent]
})
export class RecuperarPage implements OnDestroy {
  email = '';
  readonly enviando = signal(false);
  readonly enviado = signal(false);
  readonly esperaReenvio = signal(0);

  private readonly authService = inject(AuthService);
  private readonly toastController = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  async enviar(): Promise<void> {
    if (this.enviando() || this.esperaReenvio() > 0) return;
    const correo = this.email.trim();
    if (!CORREO_VALIDO.test(correo)) {
      await this.avisar('recuperar.errores.correo_invalido');
      return;
    }

    this.enviando.set(true);
    try {
      await this.authService.solicitarRecuperacion(correo);
      this.enviado.set(true);
      this.iniciarEspera(ESPERA_REENVIO_S);
    } catch (error) {
      const codigo = codigoDeError(error);
      const estado = estadoHttp(error);
      if (codigo === 'over_email_send_rate_limit' || estado === 429) {
        await this.avisar('recuperar.errores.limite');
      } else if (esSinConexion(error)) {
        await this.avisar('recuperar.errores.red');
      } else if (estado >= 500) {
        // El servidor respondió pero no pudo enviar el correo (p. ej. SMTP mal configurado).
        console.error('[Recuperar] El servidor no pudo enviar el correo:', error);
        await this.avisar('recuperar.errores.envio');
      } else {
        // Cualquier otra respuesta se trata como enviada: no se revela si la cuenta existe.
        console.error('[Recuperar]', error);
        this.enviado.set(true);
        this.iniciarEspera(ESPERA_REENVIO_S);
      }
    } finally {
      this.enviando.set(false);
    }
  }

  usarOtroCorreo(): void {
    this.enviado.set(false);
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  private iniciarEspera(segundos: number): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.esperaReenvio.set(segundos);
    this.temporizador = setInterval(() => {
      const restante = this.esperaReenvio() - 1;
      this.esperaReenvio.set(Math.max(0, restante));
      if (restante <= 0 && this.temporizador) {
        clearInterval(this.temporizador);
        this.temporizador = null;
      }
    }, 1000);
  }

  private async avisar(clave: string): Promise<void> {
    const toast = await this.toastController.create({
      message: this.transloco.translate(clave),
      duration: 3500,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
}
