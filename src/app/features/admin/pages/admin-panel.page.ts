import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonLabel, IonSegment, IonSegmentButton,
  IonTitle, IonToolbar
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { settingsOutline } from 'ionicons/icons';
import { AuthService } from '@core/auth/auth.service';
import { AdminAuditoriaComponent } from '../ui/admin-auditoria.component';
import { AdminResumenComponent } from '../ui/admin-resumen.component';
import { AdminSesionesComponent } from '../ui/admin-sesiones.component';
import { AdminUsuariosComponent } from '../ui/admin-usuarios.component';

addIcons({ settingsOutline });

type Pestana = 'resumen' | 'usuarios' | 'sesiones' | 'auditoria';
const PESTANAS: readonly Pestana[] = ['resumen', 'usuarios', 'sesiones', 'auditoria'];
const CLAVE_PESTANA = 'pacamaraqs.admin.pestana';

/**
 * Panel de administrador. Solo llega aquí un usuario con rol
 * 'administrador' y verificación en dos pasos (authGuard + roleGuard), y
 * además cada consulta se vuelve a validar en el servidor con es_admin().
 */
@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonSegment,
    IonSegmentButton, IonLabel, TranslocoPipe,
    AdminResumenComponent, AdminUsuariosComponent, AdminSesionesComponent, AdminAuditoriaComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./admin-panel.page.scss'],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>
          <div class="ap-titulo">{{ 'admin.panel_administrador' | transloco }}</div>
          <div class="ap-subtitulo">{{ usuario()?.nombre }}</div>
        </ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" (click)="irAConfiguracion()" [attr.aria-label]="'config.abrir' | transloco">
            <ion-icon slot="icon-only" name="settings-outline" aria-hidden="true"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar class="ap-tabs">
        <ion-segment [value]="pestana()" (ionChange)="cambiarPestana($any($event).detail.value)" [scrollable]="true">
          @for (p of pestanas; track p) {
            <ion-segment-button [value]="p"><ion-label>{{ 'admin.tabs.' + p | transloco }}</ion-label></ion-segment-button>
          }
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding ap-content">
      <main class="ap-contenedor">
        @switch (pestana()) {
          @case ('usuarios') { <app-admin-usuarios></app-admin-usuarios> }
          @case ('sesiones') { <app-admin-sesiones></app-admin-sesiones> }
          @case ('auditoria') { <app-admin-auditoria></app-admin-auditoria> }
          @default { <app-admin-resumen></app-admin-resumen> }
        }
      </main>
    </ion-content>
  `
})
export class AdminPanelPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly usuario = this.auth.usuario;
  readonly pestanas = PESTANAS;
  readonly pestana = signal<Pestana>(this.pestanaGuardada());

  cambiarPestana(valor: Pestana): void {
    if (!PESTANAS.includes(valor)) return;
    this.pestana.set(valor);
    try { sessionStorage.setItem(CLAVE_PESTANA, valor); } catch { /* sin almacenamiento */ }
  }

  irAConfiguracion(): void {
    // Libera el foco antes de navegar: Ionic marca la página que sale con aria-hidden.
    (document.activeElement as HTMLElement | null)?.blur();
    void this.router.navigateByUrl('/configuracion');
  }

  private pestanaGuardada(): Pestana {
    try {
      const valor = sessionStorage.getItem(CLAVE_PESTANA) as Pestana | null;
      return valor && PESTANAS.includes(valor) ? valor : 'resumen';
    } catch {
      return 'resumen';
    }
  }
}
