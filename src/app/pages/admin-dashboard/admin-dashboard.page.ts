import { Component, inject } from '@angular/core';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ToastController
} from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { settingsOutline } from 'ionicons/icons';
import { CierreSesionService } from '../../core/auth/cierre-sesion.service';

import { TranslocoPipe } from '@jsverse/transloco';
addIcons({ settingsOutline });

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [TranslocoPipe, IonButton, IonButtons, IonIcon, IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'admin.panel_administrador' | transloco }}</ion-title>
        <ion-buttons slot="end">
          <ion-button class="btn-config" fill="clear" (click)="irAConfiguracion()" [attr.aria-label]="'config.abrir' | transloco">
            <ion-icon slot="icon-only" name="settings-outline" aria-hidden="true"></ion-icon>
          </ion-button>
        </ion-buttons>
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
  private readonly cierreSesion = inject(CierreSesionService);
  private readonly router = inject(Router);

  irAConfiguracion(): void {
    // Libera el foco antes de navegar: Ionic marca la página que sale con
    // aria-hidden y el foco no puede quedar dentro de un elemento oculto.
    (document.activeElement as HTMLElement | null)?.blur();
    void this.router.navigateByUrl('/configuracion');
  }
  private readonly toastController = inject(ToastController);
  cerrandoSesion = false;

  async cerrarSesion(): Promise<void> {
    if (this.cerrandoSesion) return;
    this.cerrandoSesion = true;
    try {
      await this.cierreSesion.confirmarYSalir();
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
