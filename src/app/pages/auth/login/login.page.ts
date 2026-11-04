import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonSpinner, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth';
import { mensajeDeError } from '../../../core/utils/errores';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonInput, IonButton, IonSpinner, CommonModule, FormsModule, RouterLink]
})
export class LoginPage implements OnInit {
  // ngModel necesita propiedades mutables; el resto del estado es signal.
  email = '';
  password = '';
  readonly isLoading = signal(false);
  readonly verificandoSesion = signal(true);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastController = inject(ToastController);

  ngOnInit(): void {
    const authError = this.route.snapshot.queryParamMap.get('authError');
    if (authError === 'role') {
      void this.mostrarToast('No se pudo verificar tu rol. Intenta de nuevo o contacta al administrador.');
    } else if (authError === 'session') {
      void this.mostrarToast('No se pudo validar la sesión. Inicia sesión nuevamente.');
    }
    void this.redirigirSiYaAutenticado(authError === null);
  }

  async login(): Promise<void> {
    if (this.isLoading()) return;
    if (!this.email.trim() || !this.password) {
      await this.mostrarToast('Ingresa tu correo y contraseña.');
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

  private traducirError(error: unknown): string {
    const mensaje = mensajeDeError(error, 'Error al iniciar sesión.');
    if (/invalid login credentials/i.test(mensaje)) return 'Correo o contraseña incorrectos.';
    if (/email not confirmed/i.test(mensaje)) return 'Confirma tu correo antes de iniciar sesión.';
    if (/failed to fetch|network/i.test(mensaje)) return 'Sin conexión. Revisa tu red e intenta de nuevo.';
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
