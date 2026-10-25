import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonSpinner, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonInput, IonButton, IonSpinner, CommonModule, FormsModule, RouterLink]
})
export class LoginPage {
  email = '';
  password = '';
  isLoading = false;
  isLoadingAnonimo = false;

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastController = inject(ToastController);

  async login(): Promise<void> {
    if (!this.email.trim() || !this.password) {
      await this.mostrarToast('Ingresa tu correo y contraseña.');
      return;
    }

    this.isLoading = true;
    try {
      await this.authService.login(this.email, this.password);
      await this.irAlDashboard();
    } catch (error) {
      await this.mostrarToast(this.mensajeError(error, 'Error al iniciar sesión.'));
    } finally {
      this.isLoading = false;
    }
  }

  async loginAnonimo(): Promise<void> {
    this.isLoadingAnonimo = true;
    try {
      await this.authService.loginAnonimo();
      await this.irAlDashboard();
    } catch (error) {
      await this.mostrarToast(this.mensajeError(error, 'Error al entrar como invitado.'));
    } finally {
      this.isLoadingAnonimo = false;
    }
  }

  async irARegistro(): Promise<void> {
    await this.router.navigateByUrl('/registro');
  }

  private async irAlDashboard(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination = returnUrl?.startsWith('/') && !returnUrl.startsWith('//')
      ? returnUrl
      : '/dashboard';
    await this.router.navigateByUrl(destination, { replaceUrl: true });
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

  private mensajeError(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
