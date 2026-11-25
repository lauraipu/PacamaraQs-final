import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonRange,
  IonSpinner, IonTextarea, IonTitle, IonToggle, IonToolbar, ModalController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, closeOutline, informationCircleOutline, warningOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { TrPipe } from '@core/i18n/tr';
import { mensajeDeError } from '@core/errores/errores';
import { SesionesRepository } from '@core/data-access/sesiones/sesiones.repository';
import {
  catadoresSonRecomendados, FormatoCva, getFormatoById, normalizarNombresMuestras, Sesion
} from '@domain/sesion/sesion.model';
import { NombresMuestrasComponent } from '../nombres-muestras/nombres-muestras.component';

export interface ResultadoEdicionSesion {
  sesion: Sesion;
  nombresMuestras: Map<number, string>;
}

/**
 * Edición de la sesión desde la sala de espera (solo organizador, antes de
 * iniciar). Guarda con el RPC editar_sesion y se cierra con role 'guardado'.
 */
@Component({
  selector: 'app-editar-sesion-modal',
  standalone: true,
  imports: [
    FormsModule, TranslocoPipe, TrPipe, NombresMuestrasComponent,
    IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonRange,
    IonSpinner, IonTextarea, IonTitle, IonToggle, IonToolbar
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>{{ 'editar.titulo' | transloco }}</ion-title>
        <ion-buttons slot="end">
          <ion-button [attr.aria-label]="'editar.cancelar' | transloco" (click)="cerrar()" [disabled]="guardando()">
            <ion-icon slot="icon-only" name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding es-content">
      @if (error(); as mensaje) {
        <div class="es-error" role="alert">{{ mensaje | tr }}</div>
      }

      <section class="es-card">
        <label class="es-label" for="es-nombre">{{ 'crear.nombre_de_la_sesion' | transloco }}</label>
        <ion-input id="es-nombre" class="custom-input" [(ngModel)]="nombre" [maxlength]="120"></ion-input>

        <label class="es-label" for="es-notas">{{ 'crear.notas_adicionales' | transloco }}</label>
        <ion-textarea id="es-notas" class="custom-input" [(ngModel)]="notas" [autoGrow]="true" rows="3"></ion-textarea>
      </section>

      <section class="es-card">
        <h2 class="es-title">{{ 'crear.formato_cva' | transloco }}</h2>
        <div class="es-formatos">
          @for (f of formatos; track f.id) {
            <button type="button" class="es-formato" [class.es-formato--on]="formato === f.id"
              [attr.aria-pressed]="formato === f.id" (click)="formato = f.id">
              {{ f.titulo | tr }}
              @if (formato === f.id) { <ion-icon name="checkmark-circle" aria-hidden="true"></ion-icon> }
            </button>
          }
        </div>
        @if (formato !== formatoOriginal) {
          <p class="es-nota">{{ 'editar.aviso_formato' | transloco }}</p>
        }
      </section>

      <section class="es-card">
        <div class="es-slider-head">
          <span class="es-label">{{ 'crear.numero_de_muestras' | transloco }}</span>
          <strong>{{ numeroMuestras }}</strong>
        </div>
        <ion-range [(ngModel)]="numeroMuestras" [min]="1" [max]="20" [step]="1"
          [attr.aria-label]="'crear.numero_de_muestras' | transloco"></ion-range>

        <div class="es-slider-head">
          <span class="es-label">{{ 'crear.catadores_objetivo' | transloco }}</span>
          <strong>{{ catadoresObjetivo }}</strong>
        </div>
        <ion-range [(ngModel)]="catadoresObjetivo" [min]="1" [max]="15" [step]="1"
          [attr.aria-label]="'crear.catadores_objetivo' | transloco"></ion-range>
        <p class="es-nota" [class.es-nota--aviso]="!recomendado()">
          <ion-icon [name]="recomendado() ? 'information-circle-outline' : 'warning-outline'" aria-hidden="true"></ion-icon>
          {{ 'crear.recomendacion_catadores' | transloco }}
        </p>

        <div class="es-toggle">
          <div>
            <div class="es-toggle__title">{{ 'crear.participaras_como_catador' | transloco }}</div>
            <div class="es-toggle__desc">{{ 'crear.tu_evaluacion_contara_igual' | transloco }}</div>
          </div>
          <ion-toggle [(ngModel)]="organizadorParticipa"
            [attr.aria-label]="'crear.participar_como_catador' | transloco"></ion-toggle>
        </div>
        @if (catadoresObjetivo === 1 && organizadorParticipa) {
          <p class="es-nota">
            <ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon>
            {{ 'editar.individual_iniciar' | transloco }}
          </p>
        }
      </section>

      <section class="es-card">
        <h2 class="es-title">{{ 'crear.nombres_de_las_muestras' | transloco }}</h2>
        <p class="es-nota">{{ 'crear.nombres_muestras_ayuda' | transloco }}</p>
        <app-nombres-muestras [total]="numeroMuestras" [(nombres)]="nombres"></app-nombres-muestras>
      </section>
    </ion-content>

    <ion-footer class="ion-no-border es-footer">
      <ion-button fill="outline" (click)="cerrar()" [disabled]="guardando()">{{ 'editar.cancelar' | transloco }}</ion-button>
      <ion-button class="primary-btn" (click)="guardar()" [disabled]="guardando() || !nombre.trim()">
        @if (guardando()) { <ion-spinner name="crescent"></ion-spinner> } @else { {{ 'editar.guardar' | transloco }} }
      </ion-button>
    </ion-footer>
  `,
  styles: [`
    .es-content { --background: var(--app-bg-screen); }
    .es-card {
      margin-bottom: 12px;
      padding: 16px;
      border: 1px solid var(--app-border);
      border-radius: var(--app-radius-card, 12px);
      background: var(--app-bg-card);
    }
    .es-title, .es-label {
      display: block;
      margin: 0 0 8px;
      color: var(--app-text-muted);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .es-label + ion-input, .es-label + ion-textarea { margin-bottom: 14px; }
    .es-formatos { display: flex; flex-wrap: wrap; gap: 8px; }
    .es-formato {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 8px 14px;
      border: 1px solid var(--app-border);
      border-radius: 10px;
      background: var(--app-bg-card);
      color: var(--app-text-main);
      font: inherit;
      font-size: 0.875rem;
    }
    .es-formato--on { border-color: var(--app-primary-dark); font-weight: 700; }
    .es-slider-head { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .es-slider-head .es-label { margin: 0; }
    .es-nota {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin: 8px 0 12px;
      color: var(--app-text-muted);
      font-size: 0.75rem;
      line-height: 1.4;
    }
    .es-nota--aviso { color: #92400e; }
    .es-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 8px;
      padding-top: 14px;
      border-top: 1px solid var(--app-border);
    }
    .es-toggle__title { color: var(--app-text-main); font-size: 0.8125rem; font-weight: 700; }
    .es-toggle__desc { margin-top: 2px; color: var(--app-text-muted); font-size: 0.75rem; }
    .es-error {
      margin-bottom: 12px;
      padding: 12px;
      border-radius: 8px;
      background: var(--app-error-bg, #ffe4e6);
      color: var(--app-error-text, #991b1b);
      font-size: 0.8125rem;
    }
    .es-footer {
      display: flex;
      gap: 12px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: var(--app-bg-card);
    }
    .es-footer ion-button { flex: 1; }
  `]
})
export class EditarSesionModalComponent implements OnInit {
  @Input({ required: true }) sesion!: Sesion;
  @Input() nombresActuales: ReadonlyMap<number, string> = new Map();

  private readonly modalCtrl = inject(ModalController);
  private readonly sesionService = inject(SesionesRepository);

  readonly formatos = [FormatoCva.COMBINADO, FormatoCva.AFECTIVO, FormatoCva.DESCRIPTIVO];
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  nombre = '';
  notas = '';
  formato: string = FormatoCva.COMBINADO.id;
  formatoOriginal: string = FormatoCva.COMBINADO.id;
  numeroMuestras = 1;
  catadoresObjetivo = 3;
  organizadorParticipa = true;
  nombres: string[] = [];

  constructor() {
    addIcons({ checkmarkCircle, closeOutline, informationCircleOutline, warningOutline });
  }

  ngOnInit(): void {
    this.nombre = this.sesion.nombre;
    this.notas = this.sesion.notas ?? '';
    this.formato = getFormatoById(this.sesion.formato).id;
    this.formatoOriginal = this.formato;
    this.numeroMuestras = this.sesion.numeroMuestras;
    this.catadoresObjetivo = this.sesion.catadoresObjetivo;
    this.organizadorParticipa = this.sesion.organizadorParticipa;
    this.nombres = Array.from({ length: 20 }, (_, i) => this.nombresActuales.get(i + 1) ?? '');
  }

  recomendado(): boolean {
    return catadoresSonRecomendados(this.catadoresObjetivo);
  }

  cerrar(): void {
    if (this.guardando()) return;
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async guardar(): Promise<void> {
    if (this.guardando() || !this.nombre.trim()) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      const nombresMuestras = normalizarNombresMuestras(this.nombres, this.numeroMuestras);
      const sesion = await this.sesionService.editarSesion(this.sesion.id, {
        nombre: this.nombre,
        notas: this.notas,
        formato: this.formato,
        numeroMuestras: this.numeroMuestras,
        catadoresObjetivo: this.catadoresObjetivo,
        nombresMuestras,
        organizadorParticipa: this.organizadorParticipa
      });
      const mapa = new Map<number, string>();
      nombresMuestras.forEach((nombre, i) => { if (nombre) mapa.set(i + 1, nombre); });
      const resultado: ResultadoEdicionSesion = { sesion, nombresMuestras: mapa };
      await this.modalCtrl.dismiss(resultado, 'guardado');
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo guardar la sesión.'));
    } finally {
      this.guardando.set(false);
    }
  }
}
