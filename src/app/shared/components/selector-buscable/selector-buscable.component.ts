import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonModal, IonSearchbar, IonTitle, IonToolbar
} from '@ionic/angular';

import { TranslocoPipe } from '@jsverse/transloco';
import { TrPipe } from '../../../core/i18n/tr';
export interface OpcionBuscable { valor: string; etiqueta: string; detalle?: string; }

const normalizar = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Select con buscador. Ionic 9 no trae `interface="searchbar"` en ion-select
 * (solo alert / action-sheet / popover / modal), así que se usa el patrón
 * oficial: botón → ion-modal con ion-searchbar + ion-list.
 * Con `permitirOtro`, lo escrito en el buscador puede usarse como valor.
 */
@Component({
  selector: 'app-selector-buscable',
  standalone: true,
  imports: [TranslocoPipe, TrPipe, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonSearchbar, IonList, IonItem, IonLabel],
  template: `
    <button type="button" class="selector-buscable notes-panel__textarea" [attr.aria-label]="titulo" (click)="abierto.set(true)">
      <span [class.selector-buscable__ph]="!valor">{{ (etiquetaActual() | tr) || placeholder }}</span>
      <span aria-hidden="true">▾</span>
    </button>
    <ion-modal [isOpen]="abierto()" (didDismiss)="cerrar()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ titulo }}</ion-title>
            <ion-buttons slot="end"><ion-button (click)="cerrar()">{{ 'comun.cerrar' | transloco }}</ion-button></ion-buttons>
          </ion-toolbar>
          <ion-toolbar>
            <ion-searchbar [placeholder]="'comun.buscar' | transloco" [debounce]="100" (ionInput)="busqueda.set($event.detail.value ?? '')"></ion-searchbar>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-list>
            @if (permitirOtro && busqueda().trim() && !coincidenciaExacta()) {
              <ion-item button [detail]="false" (click)="elegir(busqueda().trim())"><ion-label>{{ 'comun.usar' | transloco: { p0: busqueda().trim() } }}</ion-label></ion-item>
            }
            @for (o of filtradas(); track o.valor) {
              <ion-item button [detail]="false" (click)="elegir(o.valor)">
                <ion-label>{{ o.etiqueta | tr }}@if (o.detalle) {<p>{{ o.detalle | tr }}</p>}</ion-label>
                @if (o.valor === valor) { <span slot="end" [attr.aria-label]="'comun.seleccionado' | transloco">✓</span> }
              </ion-item>
            } @empty {
              <ion-item lines="none"><ion-label color="medium">{{ 'comun.sin_resultados' | transloco }}</ion-label></ion-item>
            }
          </ion-list>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .selector-buscable { display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; cursor: pointer; }
    .selector-buscable__ph { opacity: .55; }
  `]
})
export class SelectorBuscableComponent {
  @Input() titulo = 'Seleccionar';
  @Input() placeholder = 'Seleccionar';
  @Input() valor = '';
  @Input() permitirOtro = false;
  @Input() set opciones(lista: readonly OpcionBuscable[]) { this.lista.set(lista); }
  @Output() valorChange = new EventEmitter<string>();

  readonly abierto = signal(false);
  readonly busqueda = signal('');
  private readonly lista = signal<readonly OpcionBuscable[]>([]);

  readonly filtradas = computed(() => {
    const q = normalizar(this.busqueda().trim());
    return q ? this.lista().filter(o => normalizar(`${o.etiqueta} ${o.valor} ${o.detalle ?? ''}`).includes(q)) : this.lista();
  });
  readonly coincidenciaExacta = computed(() =>
    this.lista().some(o => normalizar(o.etiqueta) === normalizar(this.busqueda().trim()))
  );

  etiquetaActual(): string {
    return this.lista().find(o => o.valor === this.valor)?.etiqueta ?? this.valor;
  }

  elegir(valor: string): void {
    this.valorChange.emit(valor);
    this.cerrar();
  }

  cerrar(): void {
    this.abierto.set(false);
    this.busqueda.set('');
  }
}
