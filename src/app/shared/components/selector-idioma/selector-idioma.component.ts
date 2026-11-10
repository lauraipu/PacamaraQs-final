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
    <ion-select class="selector-idioma" interface="popover" fill="outline"
      [attr.aria-label]="'idioma.etiqueta' | transloco"
      [value]="idioma.actual()" (ionChange)="idioma.cambiar($event.detail.value)">
      <span slot="label" class="sr-only">{{ 'idioma.etiqueta' | transloco }}</span>
      @for (i of idiomas; track i) {
        <ion-select-option [value]="i" [attr.lang]="i">{{ 'idioma.' + i | transloco }}</ion-select-option>
      }
    </ion-select>
  `,
  styles: [`
    :host { display: inline-block; }
    .selector-idioma { --padding-start: 12px; --padding-end: 8px; min-height: 44px; min-width: 128px; font-size: 14px; }
  `]
})
export class SelectorIdiomaComponent {
  readonly idioma = inject(IdiomaService);
  readonly idiomas = IDIOMAS;
}
