import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActionSheetController, IonButton, IonIcon } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { checkmarkOutline, languageOutline } from 'ionicons/icons';
import { IDIOMAS, IdiomaService } from '../../../core/i18n/idioma.service';

// La app registra cada ícono que usa (sin esto Ionicons no lo encuentra).
addIcons({ languageOutline, checkmarkOutline });

/**
 * Selector de idioma (es / en / it / zh): solo un ícono discreto; al tocarlo
 * sube un ActionSheet con los idiomas, cada uno escrito en su propia lengua.
 * El idioma actual va marcado con un check y aria-current.
 */
@Component({
  selector: 'app-selector-idioma',
  standalone: true,
  imports: [IonButton, IonIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-button fill="clear" class="selector-idioma" (click)="abrir()"
      [attr.aria-label]="('idioma.etiqueta' | transloco) + ': ' + ('idioma.' + idioma.actual() | transloco)"
      [attr.title]="'idioma.etiqueta' | transloco">
      <ion-icon slot="icon-only" name="language-outline" aria-hidden="true"></ion-icon>
    </ion-button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .selector-idioma {
      --padding-start: 0;
      --padding-end: 0;
      --padding-top: 0;
      --padding-bottom: 0;
      --color: var(--app-text-main);
      --background: transparent;
      --background-hover: transparent;
      --background-activated: transparent;
      --box-shadow: none;
      --border-radius: 50%;
      width: 40px;
      min-width: 40px;
      height: 40px;
      min-height: 40px;
      margin: 0;
    }
    .selector-idioma ion-icon { font-size: 24px; }
  `]
})
export class SelectorIdiomaComponent {
  readonly idioma = inject(IdiomaService);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly transloco = inject(TranslocoService);

  async abrir(): Promise<void> {
    const actual = this.idioma.actual();
    const t = (clave: string) => this.transloco.translate(clave);
    const hoja = await this.actionSheet.create({
      header: t('idioma.elegir'),
      buttons: [
        ...IDIOMAS.map(codigo => ({
          text: t(`idioma.${codigo}`),
          icon: codigo === actual ? 'checkmark-outline' : undefined,
          cssClass: codigo === actual ? 'idioma-actual' : undefined,
          htmlAttributes: { lang: codigo, 'aria-current': codigo === actual ? 'true' : 'false' },
          handler: () => { this.idioma.cambiar(codigo); }
        })),
        { text: t('idioma.cancelar'), role: 'cancel' }
      ]
    });
    await hoja.present();
  }
}
