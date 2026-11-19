import { afterNextRender, ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { helpCircleOutline } from 'ionicons/icons';
import { GuiaService } from '../../../core/guias/guia.service';
import { IdGuia } from '../../../core/guias/guias';

addIcons({ helpCircleOutline });

/**
 * Botón "?" para volver a ver la guía de la pantalla. Con `auto` (por defecto)
 * además la muestra sola la primera vez que se entra.
 */
@Component({
  selector: 'app-boton-guia',
  standalone: true,
  imports: [IonButton, IonIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-button fill="clear" class="bg" type="button" (click)="abrir()" [attr.aria-label]="'guias.comun.ver_guia' | transloco">
      <ion-icon slot="icon-only" name="help-circle-outline" aria-hidden="true"></ion-icon>
    </ion-button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .bg { --padding-start: 0; --padding-end: 0; --color: var(--app-text-muted); width: 40px; min-width: 40px; height: 40px; min-height: 40px; margin: 0; }
    .bg ion-icon { font-size: 22px; }
  `]
})
export class BotonGuiaComponent {
  readonly guia = input.required<IdGuia>();
  readonly auto = input(true);
  private readonly guias = inject(GuiaService);

  constructor() {
    afterNextRender(() => {
      if (this.auto()) setTimeout(() => void this.guias.mostrarSiPrimeraVez(this.guia()), 600);
    });
  }

  abrir(): void {
    (document.activeElement as HTMLElement | null)?.blur();
    void this.guias.abrir(this.guia());
  }
}
