import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonTitle, IonToolbar, ToastController
} from '@ionic/angular';
import { AuthService } from '../../core/services/auth';

import { TranslocoPipe } from '@jsverse/transloco';
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [TranslocoPipe, IonButton, IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'admin.panel_administrador' | transloco }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>{{ 'admin.administracion' | transloco }}</h1>
      <p>{{ 'admin.tu_cuenta_tiene_el' | transloco }}</p>
      <ion-button expand="block" fill="outline" (click)="cerrarSesion()" [disabled]="cerrandoSesion">
        {{ 'admin.cerrar_sesion' | transloco }}
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
