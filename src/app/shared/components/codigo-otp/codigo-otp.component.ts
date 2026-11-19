import {
  ChangeDetectionStrategy, Component, computed, ElementRef, input, model, output, signal, viewChild
} from '@angular/core';

let siguienteId = 0;

/**
 * Código de verificación de 6 dígitos con cajitas separadas.
 *
 * Por qué un solo <input> transparente encima de las cajitas y no 6 inputs:
 * el autocompletado del sistema ("one-time-code"), pegar el código completo
 * y los lectores de pantalla funcionan con un único campo. Las cajitas solo
 * dibujan lo que hay escrito y marcan la posición actual.
 */
@Component({
  selector: 'app-codigo-otp',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="otp" [class.otp--foco]="enfocado()" [class.otp--deshabilitado]="deshabilitado()">
      <label class="otp__label" [attr.for]="idCampo">{{ etiqueta() }}</label>
      <div class="otp__cajas" (click)="enfocar()">
        @for (i of posiciones; track i) {
          <span class="otp__caja"
            [class.otp__caja--llena]="!!digitos()[i]"
            [class.otp__caja--actual]="enfocado() && i === posicionActual()"
            aria-hidden="true">{{ digitos()[i] ?? '' }}</span>
        }
        <input #campo
          [id]="idCampo"
          class="otp__input"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern="[0-9]*"
          maxlength="6"
          [value]="valor()"
          [disabled]="deshabilitado()"
          (input)="alEscribir($any($event.target).value)"
          (focus)="enfocado.set(true)"
          (blur)="enfocado.set(false)"
          (keydown.enter)="enviar.emit()">
      </div>
    </div>
  `,
  styles: [`
    .otp { display: grid; gap: 8px; }
    .otp__label {
      color: var(--app-text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .otp__cajas {
      position: relative;
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 8px;
      max-width: 360px;
      width: 100%;
      margin: 0 auto;
    }
    .otp__caja {
      display: grid;
      place-items: center;
      aspect-ratio: 5 / 6;
      min-height: 44px;
      border: 1px solid var(--app-border-input);
      border-radius: var(--app-radius-control);
      background: var(--app-bg-card);
      color: var(--app-text-main);
      font-family: var(--app-font-mono);
      font-size: 1.375rem;
      font-weight: 600;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .otp__caja--llena { border-color: var(--app-text-muted); }
    .otp__caja--actual {
      border-color: var(--app-primary-dark);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-primary-dark) 20%, transparent);
    }
    .otp__input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      background: transparent;
      color: transparent;
      caret-color: transparent;
      font-size: 16px; /* evita el zoom automático de iOS */
      opacity: 0.01;
      cursor: text;
    }
    .otp__input:focus-visible { outline: none; }
    .otp--foco .otp__cajas { outline: none; }
    .otp--deshabilitado .otp__caja { opacity: 0.6; }
    @media (prefers-reduced-motion: reduce) { .otp__caja { transition: none; } }
  `]
})
export class CodigoOtpComponent {
  readonly valor = model('');
  readonly etiqueta = input('');
  readonly deshabilitado = input(false);
  /** Se emite con Enter o al completar los 6 dígitos. */
  readonly enviar = output<void>();

  readonly idCampo = `codigo-otp-${++siguienteId}`;
  readonly posiciones = [0, 1, 2, 3, 4, 5];
  readonly enfocado = signal(false);
  readonly digitos = computed(() => this.valor().split(''));
  readonly posicionActual = computed(() => Math.min(this.valor().length, 5));

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  alEscribir(texto: string): void {
    const limpio = (texto ?? '').replace(/\D/g, '').slice(0, 6);
    // Reescribe el input por si se pegaron letras o espacios.
    if (this.campo().nativeElement.value !== limpio) this.campo().nativeElement.value = limpio;
    const anterior = this.valor();
    this.valor.set(limpio);
    if (limpio.length === 6 && anterior.length !== 6) this.enviar.emit();
  }

  /** Siempre escribe al final: el código se llena de izquierda a derecha. */
  enfocar(): void {
    const el = this.campo().nativeElement;
    el.focus();
    const fin = el.value.length;
    el.setSelectionRange(fin, fin);
  }
}
