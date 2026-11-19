import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { shieldCheckmarkOutline, swapHorizontalOutline } from 'ionicons/icons';
import { CierreSesionService } from '../../../core/auth/cierre-sesion.service';
import { AuthService } from '@core/auth/auth.service';
import { esSinConexion } from '@core/errores/errores';
import { CodigoOtpComponent } from '../../../shared/components/codigo-otp/codigo-otp.component';

addIcons({ shieldCheckmarkOutline, swapHorizontalOutline });

/** Segundo paso del inicio de sesión: código de 6 dígitos de la app de autenticación. */
@Component({
  selector: 'app-verificar-dos-pasos',
  templateUrl: './verificar-dos-pasos.page.html',
  styleUrls: ['../recuperar/recuperar.page.scss'],
  standalone: true,
  imports: [IonContent, IonButton, IonSpinner, IonIcon, TranslocoPipe, CodigoOtpComponent]
})
export class VerificarDosPasosPage {
  readonly codigo = signal('');
  readonly verificando = signal(false);

  private readonly authService = inject(AuthService);
  private readonly cierreSesion = inject(CierreSesionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastController = inject(ToastController);
  private readonly transloco = inject(TranslocoService);

  alEscribir(valor: string): void {
    this.codigo.set(valor);
  }

  async verificar(): Promise<void> {
    if (this.verificando()) return;
    if (this.codigo().length !== 6) {
      await this.avisar('dos_pasos.errores.formato');
      return;
    }
    this.verificando.set(true);
    try {
      await this.authService.verificarCodigoDosPasos(this.codigo());
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const destino = returnUrl?.startsWith('/') && !returnUrl.startsWith('//')
        ? returnUrl
        : (await this.authService.obtenerRutaInicio()) ?? '/dashboard';
      await this.router.navigateByUrl(destino, { replaceUrl: true });
    } catch (error) {
      this.codigo.set('');
      await this.avisar(esSinConexion(error) ? 'recuperar.errores.red' : 'dos_pasos.errores.codigo');
    } finally {
      this.verificando.set(false);
    }
  }

  async salir(): Promise<void> {
    await this.cierreSesion.confirmarYSalir();
  }

  private async avisar(clave: string): Promise<void> {
    const toast = await this.toastController.create({
      message: this.transloco.translate(clave), duration: 3500, position: 'bottom', color: 'danger'
    });
    await toast.present();
  }
}
