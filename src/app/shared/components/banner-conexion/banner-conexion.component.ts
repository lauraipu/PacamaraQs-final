import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { cloudDoneOutline, cloudOfflineOutline } from 'ionicons/icons';

addIcons({ cloudOfflineOutline, cloudDoneOutline });

/** Aviso fijo arriba de todas las pantallas cuando se pierde la conexión. */
@Component({
  selector: 'app-banner-conexion',
  standalone: true,
  imports: [IonIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (estado() !== 'oculto') {
      <div class="bc" [class.bc--ok]="estado() === 'restablecida'" role="status" aria-live="polite">
        <ion-icon [name]="estado() === 'restablecida' ? 'cloud-done-outline' : 'cloud-offline-outline'" aria-hidden="true"></ion-icon>
        <span>{{ (estado() === 'restablecida' ? 'errores.conexion_restablecida' : 'errores.banner_sin_conexion') | transloco }}</span>
      </div>
    }
  `,
  styles: [`
    .bc {
      position: fixed; top: 0; left: 0; right: 0; z-index: 30000;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: calc(6px + env(safe-area-inset-top)) 12px 6px;
      background: #374151; color: #ffffff; font-size: 0.8125rem; font-weight: 600; text-align: center;
    }
    .bc--ok { background: var(--app-success, #009956); }
    .bc ion-icon { flex: none; font-size: 18px; }
  `]
})
export class BannerConexionComponent {
  readonly estado = signal<'oculto' | 'sin_conexion' | 'restablecida'>(
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'sin_conexion' : 'oculto'
  );
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const sinConexion = () => this.cambiar('sin_conexion');
    const conConexion = () => {
      if (this.estado() !== 'sin_conexion') return;
      this.cambiar('restablecida');
      this.temporizador = setTimeout(() => this.estado.set('oculto'), 3000);
    };
    window.addEventListener('offline', sinConexion);
    window.addEventListener('online', conConexion);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('offline', sinConexion);
      window.removeEventListener('online', conConexion);
      if (this.temporizador) clearTimeout(this.temporizador);
    });
  }

  private cambiar(estado: 'sin_conexion' | 'restablecida'): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.estado.set(estado);
  }
}
