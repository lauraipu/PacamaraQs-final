import { ChangeDetectionStrategy, Component, computed, inject, Input, signal } from '@angular/core';
import { IonButton, IonContent, IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { GUIAS, ICONOS_GUIAS, IdGuia } from '../../../core/guias/guias';

addIcons(ICONOS_GUIAS);

/** Guía corta de primer uso: un paso por pantalla, se puede saltar. */
@Component({
  selector: 'app-guia-modal',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="ion-padding">
      <section class="gm" role="dialog" [attr.aria-label]="'guias.' + idGuia() + '.titulo' | transloco">
        <p class="gm__contador">{{ 'guias.comun.paso' | transloco: { n: paso() + 1, total: total() } }}</p>
        <ion-icon class="gm__icono" [name]="icono()" aria-hidden="true"></ion-icon>
        <h2 class="gm__titulo">{{ 'guias.' + idGuia() + '.' + paso() + '.titulo' | transloco }}</h2>
        <p class="gm__texto">{{ 'guias.' + idGuia() + '.' + paso() + '.texto' | transloco }}</p>
        <div class="gm__puntos" aria-hidden="true">
          @for (i of indices(); track i) { <span [class.gm__punto--on]="i === paso()"></span> }
        </div>
        <div class="gm__acciones">
          @if (paso() > 0) {
            <ion-button fill="clear" class="gm__sec" (click)="paso.set(paso() - 1)">{{ 'guias.comun.anterior' | transloco }}</ion-button>
          } @else {
            <ion-button fill="clear" class="gm__sec" (click)="cerrar()">{{ 'guias.comun.saltar' | transloco }}</ion-button>
          }
          @if (ultimo()) {
            <ion-button class="primary-btn" (click)="cerrar()">{{ 'guias.comun.entendido' | transloco }}</ion-button>
          } @else {
            <ion-button class="primary-btn" (click)="paso.set(paso() + 1)">{{ 'guias.comun.siguiente' | transloco }}</ion-button>
          }
        </div>
      </section>
    </ion-content>
  `,
  styles: [`
    .gm { display: grid; justify-items: center; gap: 10px; max-width: 420px; margin: 0 auto; padding: 8px 4px 16px; text-align: center; }
    .gm__contador { margin: 0; color: var(--app-text-muted); font-size: 0.75rem; font-weight: 600; }
    .gm__icono { color: var(--app-primary-dark); font-size: 44px; }
    .gm__titulo { margin: 0; color: var(--app-text-main); font-size: 1.125rem; font-weight: 700; }
    .gm__texto { margin: 0; color: var(--app-text-muted); font-size: 0.9375rem; line-height: 1.5; }
    .gm__puntos { display: flex; gap: 6px; margin: 4px 0; }
    .gm__puntos span { width: 8px; height: 8px; border-radius: 50%; background: var(--app-border); }
    .gm__puntos .gm__punto--on { background: var(--app-primary-dark); }
    .gm__acciones { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; width: 100%; }
    .gm__acciones ion-button { flex: 1 1 120px; margin: 0; min-height: 44px; text-transform: none; }
    .gm__sec { --color: var(--app-text-muted); }
  `]
})
export class GuiaModalComponent {
  /**
   * ModalController entrega componentProps asignando propiedades
   * (Object.assign), no con setInput: un input() de signal quedaría
   * reemplazado por un texto y la plantilla fallaría en cada ciclo de
   * detección de cambios, bloqueando el resto de la app. Por eso se usa un
   * setter clásico que alimenta un signal interno.
   */
  @Input() set id(valor: IdGuia) { this._id.set(valor); }
  private readonly _id = signal<IdGuia>('dashboard');
  readonly idGuia = this._id.asReadonly();
  readonly paso = signal(0);
  private readonly modales = inject(ModalController);

  readonly total = computed(() => GUIAS[this.idGuia()].length);
  readonly indices = computed(() => Array.from({ length: this.total() }, (_, i) => i));
  readonly ultimo = computed(() => this.paso() === this.total() - 1);
  readonly icono = computed(() => GUIAS[this.idGuia()][this.paso()]);

  cerrar(): void {
    void this.modales.dismiss();
  }
}
