import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Fila de muestras de los formularios CVA. Permite saltar a cualquier muestra
 * en cualquier orden y muestra su estado: enviada, completa (sin enviar),
 * en borrador o cerrada por el organizador.
 */
@Component({
  selector: 'app-selector-muestras',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    @if (total() > 1) {
      <nav class="selector-muestras" [attr.aria-label]="'formulario.muestras' | transloco">
        @for (n of numeros(); track n) {
          @let nombre = nombres().get(n);
          <button
            type="button"
            class="selector-muestras__chip"
            [class.es-actual]="n === actual()"
            [class.es-enviada]="enviadas().has(n)"
            [class.es-completa]="!enviadas().has(n) && completas().has(n)"
            [class.es-cerrada]="cerradas().has(n)"
            [attr.aria-current]="n === actual() ? 'step' : null"
            [attr.title]="nombre || ('formulario.muestra_n' | transloco: { p0: n })"
            (click)="seleccionar.emit(n)">
            <span class="selector-muestras__num">{{ n }}</span>
            @if (nombre) { <span class="selector-muestras__nombre">{{ nombre }}</span> }
            @if (cerradas().has(n)) {
              <span class="selector-muestras__estado" aria-hidden="true">🔒</span>
            } @else if (enviadas().has(n)) {
              <span class="selector-muestras__estado" aria-hidden="true">✓</span>
            }
          </button>
        }
      </nav>
    }
  `,
  styles: [`
    :host { display: block; }
    .selector-muestras {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 8px 12px 4px;
      scrollbar-width: none;
    }
    .selector-muestras::-webkit-scrollbar { display: none; }
    .selector-muestras__chip {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      max-width: 180px;
      padding: 4px 12px;
      border: 1px solid var(--app-border);
      border-radius: 999px;
      background: var(--app-bg-card);
      color: var(--app-text-main);
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .selector-muestras__num { font-weight: 700; }
    .selector-muestras__nombre {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .selector-muestras__estado { font-size: 0.75rem; }
    .selector-muestras__chip.es-completa { border-color: var(--app-primary-dark); }
    .selector-muestras__chip.es-enviada { background: var(--app-bg-subtle); color: var(--app-text-muted); }
    .selector-muestras__chip.es-cerrada { opacity: 0.6; }
    .selector-muestras__chip.es-actual {
      background: var(--app-primary-dark);
      border-color: var(--app-primary-dark);
      color: #fff;
      opacity: 1;
    }
  `]
})
export class SelectorMuestrasComponent {
  readonly total = input.required<number>();
  readonly actual = input.required<number>();
  readonly nombres = input<ReadonlyMap<number, string>>(new Map());
  readonly enviadas = input<ReadonlySet<number>>(new Set());
  readonly completas = input<ReadonlySet<number>>(new Set());
  readonly cerradas = input<ReadonlySet<number>>(new Set());
  readonly seleccionar = output<number>();

  numeros(): number[] {
    return Array.from({ length: this.total() }, (_, i) => i + 1);
  }
}
