import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonTitle, IonToolbar, ToastController
} from '@ionic/angular';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [IonButton, IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Panel administrador</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>Administración</h1>
      <p>Tu cuenta tiene el rol de administrador.</p>
      <ion-button expand="block" fill="outline" (click)="cerrarSesion()" [disabled]="cerrandoSesion">
        Cerrar sesión
      </ion-button>
    </ion-content>
  `
})
export class AdminDashboardPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  cerrandoSesion = false;

  async cerrarSesion(): Promise<void> {
    if (this.cerrandoSesion) return;
    this.cerrandoSesion = true;
    try {
      await this.authService.signOut();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'No se pudo cerrar la sesión.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.cerrandoSesion = false;
    }
  }
}
