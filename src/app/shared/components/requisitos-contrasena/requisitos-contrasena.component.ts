import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { checkmarkCircle, ellipseOutline } from 'ionicons/icons';
import { evaluarContrasena, LONGITUD_MINIMA_CONTRASENA, nivelContrasena } from '../../../core/auth/politica-contrasena';

addIcons({ checkmarkCircle, ellipseOutline });

/**
 * Medidor de fortaleza + lista de requisitos que se marcan al cumplirse.
 * Se usa en nueva contraseña, registro y cambio de contraseña.
 */
@Component({
  selector: 'app-requisitos-contrasena',
  standalone: true,
  imports: [IonIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rc">
      @if (modo() !== 'lista') {
      <div class="rc__medidor" role="meter" aria-valuemin="0" aria-valuemax="4"
        [attr.aria-valuenow]="nivel()" [attr.aria-label]="'contrasena.fortaleza' | transloco">
        @for (i of [1, 2, 3, 4]; track i) {
          <span class="rc__barra" [class.rc__barra--on]="nivel() >= i" [attr.data-nivel]="nivel()"></span>
        }
      </div>
      <p class="rc__nivel" aria-live="polite">{{ ('contrasena.nivel_' + nivel()) | transloco }}</p>
      }
      @if (modo() !== 'medidor') {
      <ul class="rc__lista">
        @for (r of requisitos(); track r.clave) {
          <li class="rc__item" [class.rc__item--ok]="r.cumple">
            <ion-icon [name]="r.cumple ? 'checkmark-circle' : 'ellipse-outline'" aria-hidden="true"></ion-icon>
            <span>{{ ('contrasena.req_' + r.clave) | transloco: { n: minimo } }}</span>
            <span class="sr-only">{{ (r.cumple ? 'contrasena.cumple' : 'contrasena.falta') | transloco }}</span>
          </li>
        }
      </ul>
      }
    </div>
  `,
  styles: [`
    .rc { display: grid; gap: 8px; }
    .rc__medidor { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
    .rc__barra { height: 6px; border-radius: 999px; background: var(--app-border); }
    .rc__barra--on[data-nivel="1"] { background: var(--app-error, #b91c1c); }
    .rc__barra--on[data-nivel="2"] { background: #b45309; }
    .rc__barra--on[data-nivel="3"], .rc__barra--on[data-nivel="4"] { background: var(--app-success, #15803d); }
    .rc__nivel { margin: 0; color: var(--app-text-muted); font-size: 0.75rem; font-weight: 600; }
    .rc__lista { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
    .rc__item { display: flex; align-items: center; gap: 8px; color: var(--app-text-muted); font-size: 0.8125rem; }
    .rc__item ion-icon { flex: none; font-size: 1rem; }
    .rc__item--ok { color: var(--app-text-main); }
    .rc__item--ok ion-icon { color: var(--app-success, #15803d); }
  `]
})
export class RequisitosContrasenaComponent {
  /** completo = medidor + lista; medidor = solo barras; lista = solo requisitos (popover). */
  readonly modo = input<'completo' | 'medidor' | 'lista'>('completo');
  readonly contrasena = input('');
  readonly nombre = input<string | null>(null);
  readonly email = input<string | null>(null);

  readonly minimo = LONGITUD_MINIMA_CONTRASENA;
  private readonly datos = computed(() => ({ nombre: this.nombre(), email: this.email() }));
  readonly requisitos = computed(() => evaluarContrasena(this.contrasena(), this.datos()));
  readonly nivel = computed(() => nivelContrasena(this.contrasena(), this.datos()));
}
