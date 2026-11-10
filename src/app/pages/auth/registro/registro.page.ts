import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  ToastController
} from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/services/auth';
import { SelectorIdiomaComponent } from '../../../shared/components/selector-idioma/selector-idioma.component';
import { TextoPoliticaComponent } from '../../../shared/components/texto-politica/texto-politica.component';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonInput,
    IonButton,
    IonSpinner,
    IonItem,
    IonCheckbox,
    IonLabel,
    CommonModule,
    FormsModule,
    RouterLink,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    TranslocoPipe,
    SelectorIdiomaComponent,
    TextoPoliticaComponent
  ]
})
export class RegistroPage {
  nombre = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  politicaAceptada = false;
  // Signal: la app es zoneless y el estado cambia tras `await`.
  readonly isLoading = signal(false);
  readonly cargandoGoogle = signal(false);
  readonly politicaAbierta = signal(false);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly transloco = inject(TranslocoService);

  constructor() {
    effect(() => {
      const error = this.authService.errorOAuth();
      if (!error) return;
      this.cargandoGoogle.set(false);
      this.authService.limpiarErrorOAuth();
      void this.mostrarToast(this.t(error === 'cancelado' ? 'login.errores.google_cancelado' : 'login.errores.google'));
    });
  }

  /** Con Google la política se acepta en /aceptar-politica al primer ingreso (queda registrada). */
  async entrarConGoogle(): Promise<void> {
    if (this.cargandoGoogle()) return;
    this.cargandoGoogle.set(true);
    try {
      await this.authService.iniciarConGoogle();
    } catch (error) {
      console.error('[Registro] Google:', error);
      await this.mostrarToast(this.t('login.errores.google'));
    } finally {
      setTimeout(() => this.cargandoGoogle.set(false), 1500);
    }
  }

  private t(clave: string): string {
    return this.transloco.translate(clave);
  }

  async registro(): Promise<void> {
    if (!this.nombre.trim() || !this.email.trim() || !this.password || !this.confirmPassword) {
      await this.mostrarToast(this.t('registro.errores.completar'));
      return;
    }
    if (this.password.length < 6) {
      await this.mostrarToast(this.t('registro.errores.corta'));
      return;
    }
    if (this.password !== this.confirmPassword) {
      await this.mostrarToast(this.t('registro.errores.no_coinciden'));
      return;
    }
    if (!this.politicaAceptada) {
      await this.mostrarToast(this.t('registro.errores.politica'));
      return;
    }

    this.isLoading.set(true);
    try {
      const result = await this.authService.registro(this.email, this.password, this.nombre);
      if (result.session) {
        // El perfil (rol 'catador') lo crea el trigger on_auth_user_created.
        const destino = await this.authService.obtenerRutaInicio();
        await this.router.navigateByUrl(destino ?? '/login', { replaceUrl: true });
      } else {
        await this.mostrarToast(
          this.t('registro.creada'),
          'success'
        );
        await this.router.navigateByUrl('/login', { replaceUrl: true });
      }
    } catch (error) {
      await this.mostrarToast(
        error instanceof Error ? error.message : this.t('registro.errores.generico')
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  private async mostrarToast(message: string, color: 'danger' | 'success' = 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3500,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
