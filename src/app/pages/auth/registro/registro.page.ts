import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  ToastController
} from '@ionic/angular';
import { AuthService } from '../../../core/services/auth';

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
    RouterLink
  ]
})
export class RegistroPage {
  nombre = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  politicaAceptada = false;
  isLoading = false;

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);

  async registro(): Promise<void> {
    if (!this.nombre.trim() || !this.email.trim() || !this.password || !this.confirmPassword) {
      await this.mostrarToast('Completa todos los campos.');
      return;
    }
    if (this.password.length < 6) {
      await this.mostrarToast('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      await this.mostrarToast('Las contraseñas no coinciden.');
      return;
    }
    if (!this.politicaAceptada) {
      await this.mostrarToast('Debes aceptar la política de privacidad para continuar.');
      return;
    }

    this.isLoading = true;
    try {
      const result = await this.authService.registro(this.email, this.password, this.nombre);
      if (result.session) {
        await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
      } else {
        await this.mostrarToast(
          'Cuenta creada. Revisa tu correo para confirmar el registro.',
          'success'
        );
        await this.router.navigateByUrl('/login', { replaceUrl: true });
      }
    } catch (error) {
      await this.mostrarToast(
        error instanceof Error ? error.message : 'No se pudo completar el registro.'
      );
    } finally {
      this.isLoading = false;
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
