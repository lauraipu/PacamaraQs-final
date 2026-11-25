import { Component, input, model } from '@angular/core';
import { IonInput } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { MAX_LARGO_NOMBRE_MUESTRA } from '@domain/sesion/sesion.model';

/**
 * Campos para nombrar cada muestra ("Pacamara Huila", "Lote 3"…).
 * Vacío = se muestra como "Muestra N". Se usa al crear la sesión y al
 * editarla desde la sala de espera.
 */
@Component({
  selector: 'app-nombres-muestras',
  standalone: true,
  imports: [IonInput, TranslocoPipe],
  template: `
    <div class="nombres-muestras">
      @for (n of numeros(); track n) {
        <label class="nombres-muestras__fila">
          <span class="nombres-muestras__num">{{ n }}</span>
          <ion-input
            class="custom-input nombres-muestras__input"
            [value]="nombres()[n - 1] ?? ''"
            [maxlength]="maxLargo"
            [placeholder]="'formulario.muestra_n' | transloco: { p0: n }"
            [attr.aria-label]="'formulario.nombre_de_la_muestra_n' | transloco: { p0: n }"
            (ionInput)="cambiar(n - 1, $event.detail.value)"
          ></ion-input>
        </label>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .nombres-muestras { display: grid; gap: 8px; }
    .nombres-muestras__fila { display: flex; align-items: center; gap: 10px; }
    .nombres-muestras__num {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--app-bg-subtle);
      color: var(--app-text-muted);
      font-size: 0.75rem;
      font-weight: 700;
    }
    .nombres-muestras__input { flex: 1; min-width: 0; }
  `]
})
export class NombresMuestrasComponent {
  readonly total = input.required<number>();
  /** Índice 0 = muestra 1. Puede ser más largo que `total` (se conservan los sobrantes). */
  readonly nombres = model<string[]>([]);
  readonly maxLargo = MAX_LARGO_NOMBRE_MUESTRA;

  numeros(): number[] {
    return Array.from({ length: this.total() }, (_, i) => i + 1);
  }

  cambiar(indice: number, valor: string | null | undefined): void {
    const lista = [...this.nombres()];
    while (lista.length <= indice) lista.push('');
    lista[indice] = valor ?? '';
    this.nombres.set(lista);
  }
}
