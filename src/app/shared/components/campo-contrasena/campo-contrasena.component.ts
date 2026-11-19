import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { IonButton, IonContent, IonIcon, IonInput, IonPopover } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { eyeOffOutline, eyeOutline, informationCircleOutline } from 'ionicons/icons';
import { DatosPersonales, evaluarContrasena, RequisitoContrasena } from '@domain/contrasena/politica-contrasena';
import { RequisitosContrasenaComponent } from '../requisitos-contrasena/requisitos-contrasena.component';

addIcons({ eyeOutline, eyeOffOutline, informationCircleOutline });

let siguienteId = 0;

/**
 * Campo de contraseña nueva: etiqueta con ícono de ayuda (popover con los
 * requisitos), ojo para mostrar/ocultar dentro del campo y medidor de
 * fortaleza debajo. Se usa en nueva contraseña, registro y Configuración.
 */
@Component({
  selector: 'app-campo-contrasena',
  standalone: true,
  imports: [IonInput, IonButton, IonIcon, IonPopover, IonContent, TranslocoPipe, RequisitosContrasenaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cc">
      <div class="cc__etiqueta">
        <label [attr.for]="idCampo" class="cc__label">{{ etiqueta() | transloco }}</label>
        <ion-button fill="clear" size="small" class="cc__ayuda" type="button"
          [attr.aria-label]="'contrasena.ver_requisitos' | transloco"
          (click)="abrirAyuda($event)">
          <ion-icon slot="icon-only" name="information-circle-outline" aria-hidden="true"></ion-icon>
        </ion-button>
      </div>

      <ion-input
        [id]="idCampo"
        class="custom-input"
        fill="outline"
        [type]="visible() ? 'text' : 'password'"
        [autocomplete]="autocompletar()"
        [value]="valor()"
        (ionInput)="valor.set($any($event).detail.value ?? '')"
        [attr.aria-label]="etiqueta() | transloco"
        required>
        <ion-button slot="end" fill="clear" type="button" class="cc__ojo"
          [attr.aria-label]="(visible() ? 'registro.ocultar_aria' : 'registro.mostrar_aria') | transloco"
          (click)="visible.set(!visible())">
          <ion-icon slot="icon-only" [name]="visible() ? 'eye-off-outline' : 'eye-outline'" aria-hidden="true"></ion-icon>
        </ion-button>
      </ion-input>

      @if (conMedidor()) {
        <app-requisitos-contrasena modo="medidor" [contrasena]="valor()" [nombre]="datos().nombre ?? null" [email]="datos().email ?? null"></app-requisitos-contrasena>
      }

      <ion-popover [isOpen]="ayudaAbierta()" [event]="eventoAyuda()" (didDismiss)="ayudaAbierta.set(false)"
        side="bottom" alignment="start" class="cc__popover">
        <ng-template>
          <ion-content class="ion-padding">
            <p class="cc__popover-titulo">{{ 'contrasena.requisitos_titulo' | transloco }}</p>
            <app-requisitos-contrasena modo="lista" [contrasena]="valor()" [nombre]="datos().nombre ?? null" [email]="datos().email ?? null"></app-requisitos-contrasena>
          </ion-content>
        </ng-template>
      </ion-popover>
    </div>
  `,
  styles: [`
    .cc { display: grid; gap: 6px; min-width: 0; }
    .cc__etiqueta { display: flex; align-items: center; gap: 2px; }
    .cc__label { color: var(--app-text-muted); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
    .cc__ayuda {
      --padding-start: 0; --padding-end: 0; --color: var(--app-text-faint);
      width: 32px; min-width: 32px; height: 32px; min-height: 32px; margin: 0;
    }
    .cc__ayuda ion-icon { font-size: 18px; }
    .cc__ojo {
      --padding-start: 0; --padding-end: 0; --color: var(--app-text-muted);
      width: 40px; min-width: 40px; height: 40px; min-height: 40px; margin: 0;
    }
    .cc__ojo ion-icon { font-size: 20px; }
    .cc__popover { --width: min(320px, calc(100vw - 32px)); }
    .cc__popover-titulo { margin: 0 0 10px; color: var(--app-text-main); font-size: 0.875rem; font-weight: 700; }
  `]
})
export class CampoContrasenaComponent {
  readonly valor = model('');
  readonly etiqueta = input('contrasena.nueva');
  readonly autocompletar = input<'new-password' | 'current-password'>('new-password');
  readonly datos = input<DatosPersonales>({});
  readonly conMedidor = input(true);

  readonly idCampo = `campo-contrasena-${++siguienteId}`;
  readonly visible = signal(false);
  readonly ayudaAbierta = signal(false);
  readonly eventoAyuda = signal<Event | undefined>(undefined);

  readonly requisitos = computed<RequisitoContrasena[]>(() => evaluarContrasena(this.valor(), this.datos()));

  abrirAyuda(evento?: Event): void {
    this.eventoAyuda.set(evento);
    this.ayudaAbierta.set(true);
  }
}
