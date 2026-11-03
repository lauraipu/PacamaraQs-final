import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
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
export class LoginPage implements OnInit {
  email = '';
  password = '';
  isLoading = false;

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
  }

  async login(): Promise<void> {
    if (!this.email.trim() || !this.password) {
      await this.mostrarToast('Ingresa tu correo y contraseña.');
      return;
    }

    this.isLoading = true;
    try {
      await this.authService.login(this.email, this.password);
      await this.irAlPanelPorRol();
    } catch (error) {
      await this.mostrarToast(this.mensajeError(error, 'Error al iniciar sesión.'));
    } finally {
      this.isLoading = false;
    }
  }

  async irARegistro(): Promise<void> {
    await this.router.navigateByUrl('/registro');
  }

  private async irAlPanelPorRol(): Promise<void> {
    const { user } = await this.authService.getUser();
    if (!user || user.is_anonymous) {
      throw new Error('No se pudo validar tu usuario autenticado.');
    }

    const role = (await this.authService.obtenerRolGlobal(user.id)).trim().toLowerCase();
    const destination = role === 'administrador'
      ? '/admin-dashboard'
      : role === 'catador' || role === 'organizador'
        ? '/dashboard'
        : null;

    if (!destination) throw new Error('Tu cuenta no tiene un rol habilitado para acceder.');
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
