import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonSpinner, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/services/auth';
import { SelectorIdiomaComponent } from '../../../shared/components/selector-idioma/selector-idioma.component';
import { mensajeDeError } from '../../../core/utils/errores';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonInput, IonButton, IonSpinner, CommonModule, FormsModule, RouterLink, TranslocoPipe, SelectorIdiomaComponent]
})
export class LoginPage implements OnInit {
  // ngModel necesita propiedades mutables; el resto del estado es signal.
  email = '';
  password = '';
  readonly isLoading = signal(false);
  readonly verificandoSesion = signal(true);
  readonly cargandoGoogle = signal(false);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastController = inject(ToastController);
  private readonly transloco = inject(TranslocoService);

  constructor() {
    // APK: el regreso de Google llega por deep link (AuthService); aquí solo se avisa si falló.
    effect(() => {
      const error = this.authService.errorOAuth();
      if (!error) return;
      this.cargandoGoogle.set(false);
      this.authService.limpiarErrorOAuth();
      void this.mostrarToast(this.t(error === 'cancelado' ? 'login.errores.google_cancelado' : 'login.errores.google'));
    });
  }

  ngOnInit(): void {
    const authError = this.route.snapshot.queryParamMap.get('authError');
    // Web: si Google/Supabase devuelven un error, llega en la URL de /login.
    const errorOAuth = this.route.snapshot.queryParamMap.get('error');
    if (authError === 'role') {
      void this.mostrarToast(this.t('login.errores.rol'));
    } else if (authError === 'session') {
      void this.mostrarToast(this.t('login.errores.sesion'));
    } else if (errorOAuth) {
      void this.mostrarToast(this.t(errorOAuth === 'access_denied' ? 'login.errores.google_cancelado' : 'login.errores.google'));
    }
    void this.redirigirSiYaAutenticado(authError === null);
  }

  async login(): Promise<void> {
    if (this.isLoading()) return;
    if (!this.email.trim() || !this.password) {
      await this.mostrarToast(this.t('login.errores.completar'));
      return;
    }

    this.isLoading.set(true);
    try {
      const rol = await this.authService.login(this.email, this.password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const esRutaInterna = !!returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//');
      // El administrador siempre va a su panel; el catador puede volver a donde estaba.
      const destino = rol === 'catador' && esRutaInterna
        ? returnUrl
        : this.authService.rutaInicioPorRol(rol);
      this.password = '';
      await this.router.navigateByUrl(destino, { replaceUrl: true });
    } catch (error) {
      await this.mostrarToast(this.traducirError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async entrarConGoogle(): Promise<void> {
    if (this.cargandoGoogle()) return;
    this.cargandoGoogle.set(true);
    try {
      await this.authService.iniciarConGoogle();
    } catch (error) {
      console.error('[Login] Google:', error);
      await this.mostrarToast(this.traducirError(error, 'login.errores.google'));
    } finally {
      // Web: la página se va a Google. APK: el navegador ya se abrió.
      setTimeout(() => this.cargandoGoogle.set(false), 1500);
    }
  }

  async irARegistro(): Promise<void> {
    await this.router.navigateByUrl('/registro');
  }

  /** Con sesión válida, /login no se muestra: se va directo al panel del rol. */
  private async redirigirSiYaAutenticado(permitido: boolean): Promise<void> {
    try {
      if (!permitido) return;
      const destino = await this.authService.obtenerRutaInicio();
      if (destino && destino !== '/login') {
        await this.router.navigateByUrl(destino, { replaceUrl: true });
      }
    } catch {
      // Sin sesión o sin rol: se queda en el login.
    } finally {
      this.verificandoSesion.set(false);
    }
  }

  private t(clave: string): string {
    return this.transloco.translate(clave);
  }

  private traducirError(error: unknown, generico = 'login.errores.generico'): string {
    const mensaje = mensajeDeError(error, this.t(generico));
    if (/invalid login credentials/i.test(mensaje)) return this.t('login.errores.credenciales');
    if (/email not confirmed/i.test(mensaje)) return this.t('login.errores.no_confirmado');
    if (/failed to fetch|network/i.test(mensaje)) return this.t('login.errores.red');
    return mensaje;
  }

  private async mostrarToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
}
