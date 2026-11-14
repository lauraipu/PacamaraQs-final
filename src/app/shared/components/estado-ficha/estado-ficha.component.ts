import { Component, input, output } from '@angular/core';

import { TranslocoPipe } from '@jsverse/transloco';
import { TrPipe } from '../../../core/i18n/tr';
/**
 * Aviso de sincronización de fichas CVA (offline-first) y de muestra cerrada.
 * Se coloca al inicio de los 4 formularios de evaluación.
 */
@Component({
  selector: 'app-estado-ficha',
  standalone: true,
  imports: [TranslocoPipe, TrPipe],
  template: `
    @if (muestraCerrada()) {
      <div class="estado-ficha estado-ficha--cerrada" role="status">
        {{ 'estado.esta_muestra_fue_cerrada' | transloco }}
      </div>
    }
    @if (pendientes() > 0) {
      <div class="estado-ficha estado-ficha--pendiente" role="status">
        <span>
          {{ 'estado.guardado_localmente_reintentando_ficha' | transloco: { p0: (pendientes()), p1: (pendientes() === 1 ? '' : 's'), p2: (enLinea() ? '' : ('estado.sin_conexion' | transloco)) } }}
        </span>
        <button type="button" (click)="reintentar.emit()">{{ 'estado.reintentar_ahora' | transloco }}</button>
      </div>
    }
    @if (esperandoFinalizar()) {
      <div class="estado-ficha estado-ficha--pendiente" role="status">
        <span>{{ 'estado.terminaste_la_cata_las' | transloco }}</span>
        <button type="button" (click)="salir.emit()">{{ 'estado.salir_ahora' | transloco }}</button>
      </div>
    }
    @if (rechazo(); as mensaje) {
      <div class="estado-ficha estado-ficha--error" role="alert">{{ mensaje | tr }}</div>
    }
  `,
  styles: [`
    :host { display: block; }
    .estado-ficha {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 8px 12px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 0.75rem;
      line-height: 1.4;
    }
    .estado-ficha--pendiente { background: #fef9c3; color: #854d0e; }
    .estado-ficha--cerrada { background: var(--app-bg-subtle); color: var(--app-text-muted); }
    .estado-ficha--error { background: var(--app-error-bg); color: var(--app-error-text); }
    button {
      flex: none;
      padding: 4px 10px;
      border: 1px solid currentColor;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
  `]
})
export class EstadoFichaComponent {
  readonly pendientes = input(0);
  readonly enLinea = input(true);
  readonly muestraCerrada = input(false);
  readonly rechazo = input<string | null>(null);
  readonly esperandoFinalizar = input(false);
  readonly reintentar = output<void>();
  readonly salir = output<void>();
}
