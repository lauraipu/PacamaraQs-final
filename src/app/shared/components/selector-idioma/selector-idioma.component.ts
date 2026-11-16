import { Component, inject } from '@angular/core';
import { IonSelect, IonSelectOption } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { IDIOMAS, IdiomaService } from '../../../core/i18n/idioma.service';

/** Selector de idioma (es / en / it / zh). Cada idioma se muestra en su propia lengua. */
@Component({
  selector: 'app-selector-idioma',
  standalone: true,
  imports: [IonSelect, IonSelectOption, TranslocoPipe],
  template: `
    <div class="selector-idioma__control">
      <img class="selector-idioma__logo" src="assets/icon/logopacamara.png" alt="" aria-hidden="true">
      <ion-select class="selector-idioma" interface="popover" fill="outline"
        [attr.aria-label]="'idioma.etiqueta' | transloco"
        [value]="idioma.actual()" (ionChange)="idioma.cambiar($event.detail.value)">
        <span slot="label" class="sr-only">{{ 'idioma.etiqueta' | transloco }}</span>
        @for (i of idiomas; track i) {
          <ion-select-option [value]="i" [attr.lang]="i">{{ 'idioma.' + i | transloco }}</ion-select-option>
        }
      </ion-select>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .selector-idioma__control {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 6px 4px 8px;
      border: 1px solid var(--app-border, #d9e0db);
      border-radius: 14px;
      background: color-mix(in srgb, var(--app-bg-card, #fff) 88%, transparent);
      box-shadow: 0 4px 14px rgb(34 55 42 / 8%);
    }
    .selector-idioma__logo {
      width: 26px;
      height: 26px;
      flex: 0 0 26px;
      border-radius: 8px;
      object-fit: cover;
    }
    .selector-idioma { --padding-start: 0; --padding-end: 4px; min-height: 44px; min-width: 112px; font-size: 0.875rem; }
  `]
})
export class SelectorIdiomaComponent {
  readonly idioma = inject(IdiomaService);
  readonly idiomas = IDIOMAS;
}
