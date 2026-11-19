import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton, IonIcon, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RespaldoPipe } from '@shared/pipes/respaldo.pipe';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline, lockClosedOutline, refreshOutline, searchOutline } from 'ionicons/icons';
import { AdminRepository } from '../data-access/admin.repository';
import {
  AdminEvento, FiltroAuditoria, OPERACIONES_AUDITORIA, OperacionAuditoria, TABLAS_AUDITORIA, TablaAuditoria
} from '../models/admin.models';
import { formatearFecha } from '@shared/utils/formato';
import { ListaPaginada } from '@shared/utils/lista-paginada';

addIcons({ refreshOutline, cloudOfflineOutline, searchOutline, lockClosedOutline });

/**
 * Pestaña "Auditoría": historial de cambios registrado por los triggers de la
 * base de datos y por los cambios de rol. Los puntajes se omiten en el servidor.
 */
@Component({
  selector: 'app-admin-auditoria',
  standalone: true,
  imports: [IonButton, IonIcon, IonSelect, IonSelectOption, IonSpinner, TranslocoPipe, RespaldoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./admin-comun.scss'],
  styles: [`
    .au-nota { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; color: var(--app-text-muted); font-size: 0.8125rem; }
    .au-fila { grid-template-columns: minmax(0, 1fr); }
    .au-linea { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
    .au-hora { color: var(--app-text-faint); font-size: 0.75rem; white-space: nowrap; }
    @media (min-width: 768px) {
      .au-fila { grid-template-columns: 170px minmax(0, 1fr); align-items: center; }
    }
  `],
  template: `
    <p class="au-nota"><ion-icon name="lock-closed-outline" aria-hidden="true"></ion-icon>{{ 'admin.auditoria.nota_privacidad' | transloco }}</p>

    <div class="ad-filtros">
      <ion-select interface="popover" [value]="tabla()" (ionChange)="cambiarTabla($any($event).detail.value)"
        [label]="'admin.auditoria.filtro_tabla' | transloco" labelPlacement="start">
        <ion-select-option value="todos">{{ 'admin.todos' | transloco }}</ion-select-option>
        @for (t of tablas; track t) {
          <ion-select-option [value]="t">{{ 'admin.auditoria.tablas.' + t | transloco }}</ion-select-option>
        }
      </ion-select>
      <ion-select interface="popover" [value]="operacion()" (ionChange)="cambiarOperacion($any($event).detail.value)"
        [label]="'admin.auditoria.filtro_operacion' | transloco" labelPlacement="start">
        <ion-select-option value="todos">{{ 'admin.todos' | transloco }}</ion-select-option>
        @for (o of operaciones; track o) {
          <ion-select-option [value]="o">{{ 'admin.auditoria.operaciones.' + o | transloco }}</ion-select-option>
        }
      </ion-select>
      <ion-button fill="clear" (click)="recargar()" [disabled]="lista.cargando()" [attr.aria-label]="'admin.actualizar' | transloco">
        <ion-icon slot="icon-only" name="refresh-outline" aria-hidden="true"></ion-icon>
      </ion-button>
    </div>

    @if (lista.cargado() && !lista.error()) {
      <p class="ad-meta-lista" aria-live="polite">{{ 'admin.mostrando' | transloco: { n: lista.filas().length, total: lista.total() } }}</p>
    }

    @if (lista.error() && !lista.filas().length) {
      <div class="ad-estado" role="alert">
        <ion-icon name="cloud-offline-outline" aria-hidden="true"></ion-icon>
        <p>{{ 'admin.error_carga' | transloco }}</p>
        <ion-button fill="outline" (click)="recargar()">{{ 'admin.reintentar' | transloco }}</ion-button>
      </div>
    } @else if (!lista.cargado()) {
      <div class="ad-estado" role="status"><ion-spinner name="crescent"></ion-spinner><p>{{ 'admin.cargando' | transloco }}</p></div>
    } @else if (!lista.filas().length) {
      <div class="ad-estado"><ion-icon name="search-outline" aria-hidden="true"></ion-icon><p>{{ 'admin.sin_resultados' | transloco }}</p></div>
    } @else {
      <ul class="ad-lista">
        @for (e of lista.filas(); track e.id) {
          <li class="ad-fila au-fila">
            <time class="au-hora" [attr.datetime]="e.creadoEn.toISOString()">{{ fecha(e.creadoEn) }}</time>
            <div>
              <div class="au-linea">
                <span [class]="'ad-chip ' + claseOperacion(e.operacion)">{{ textoOperacion(e.operacion) }}</span>
                <strong class="ad-fila__titulo">{{ textoTabla(e.tabla) }}</strong>
                @if (e.sesionNombre) { <span class="ad-fila__sub">· {{ e.sesionNombre }}</span> }
              </div>
              <p class="ad-fila__sub">
                {{ e.actor | respaldo: ('admin.auditoria.sistema' | transloco) }}
                @if (detalle(e); as d) { · {{ d }} }
              </p>
            </div>
          </li>
        }
      </ul>

      @if (lista.hayMas()) {
        <div class="ad-mas">
          <ion-button fill="outline" [disabled]="lista.cargando()" (click)="masResultados()">
            @if (lista.cargando()) { <ion-spinner name="crescent"></ion-spinner> } @else { {{ 'admin.cargar_mas' | transloco }} }
          </ion-button>
        </div>
      }
    }
  `
})
export class AdminAuditoriaComponent implements OnInit {
  private readonly repo = inject(AdminRepository);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly tablas = TABLAS_AUDITORIA;
  readonly operaciones = OPERACIONES_AUDITORIA;
  readonly lista = new ListaPaginada<AdminEvento, FiltroAuditoria>((f, l, d) => this.repo.listarAuditoria(f, l, d), 50);
  readonly tabla = signal<'todos' | TablaAuditoria>('todos');
  readonly operacion = signal<'todos' | OperacionAuditoria>('todos');

  ngOnInit(): void {
    void this.recargar();
  }

  cambiarTabla(valor: 'todos' | TablaAuditoria): void {
    this.tabla.set(valor);
    void this.recargar();
  }

  cambiarOperacion(valor: 'todos' | OperacionAuditoria): void {
    this.operacion.set(valor);
    void this.recargar();
  }

  recargar(): Promise<void> {
    return this.lista.reiniciar(this.filtro());
  }

  masResultados(): Promise<void> {
    return this.lista.siguiente(this.filtro());
  }

  textoTabla(tabla: string): string {
    return (TABLAS_AUDITORIA as readonly string[]).includes(tabla)
      ? this.transloco.translate(`admin.auditoria.tablas.${tabla}`) : tabla;
  }

  textoOperacion(operacion: string): string {
    return (OPERACIONES_AUDITORIA as readonly string[]).includes(operacion)
      ? this.transloco.translate(`admin.auditoria.operaciones.${operacion}`) : operacion;
  }

  claseOperacion(operacion: string): string {
    switch (operacion) {
      case 'INSERT':
      case 'REACTIVACION': return 'ad-chip--ok';
      case 'DELETE':
      case 'ELIMINACION':
      case 'DESACTIVACION': return 'ad-chip--error';
      case 'CAMBIO_ROL':
      case 'EDICION': return 'ad-chip--oscuro';
      default: return '';
    }
  }

  /** Resumen legible del cambio, sin exponer datos de evaluación. */
  detalle(e: AdminEvento): string {
    const d = e.datos;
    const texto = (clave: string) => (typeof d[clave] === 'string' ? d[clave] as string : null);
    if (e.operacion === 'EDICION') {
      const cambios: string[] = [];
      if (texto('nombre_anterior') !== texto('nombre_nuevo')) cambios.push(`${texto('nombre_anterior')} → ${texto('nombre_nuevo')}`);
      if (texto('rol_anterior') !== texto('rol_nuevo')) {
        cambios.push(`${this.transloco.translate(`admin.roles.${texto('rol_anterior')}`)} → ${this.transloco.translate(`admin.roles.${texto('rol_nuevo')}`)}`);
      }
      return cambios.join(' · ');
    }
    if (e.operacion === 'DESACTIVACION' || e.operacion === 'ELIMINACION') {
      return texto('nombre') ?? texto('email') ?? '';
    }
    if (e.operacion === 'CAMBIO_ROL') {
      const antes = texto('rol_anterior');
      const despues = texto('rol_nuevo');
      return antes && despues
        ? `${this.transloco.translate(`admin.roles.${antes}`)} → ${this.transloco.translate(`admin.roles.${despues}`)}` : '';
    }
    if (e.tabla === 'sesiones' && texto('estado_anterior') && texto('estado_nuevo')) {
      return `${this.transloco.translate(`admin.estados.${texto('estado_anterior')}`)} → ${this.transloco.translate(`admin.estados.${texto('estado_nuevo')}`)}`;
    }
    if ((e.tabla === 'evaluaciones' || e.tabla === 'cierres_muestra') && d['numero_muestra'] != null) {
      return this.transloco.translate('admin.auditoria.muestra', { n: d['numero_muestra'] });
    }
    if (e.tabla === 'participantes') {
      const nombre = texto('nombre') ?? '';
      const listo = typeof d['listo'] === 'boolean'
        ? this.transloco.translate(d['listo'] ? 'admin.auditoria.listo' : 'admin.auditoria.no_listo') : '';
      return [nombre, listo].filter(Boolean).join(' · ');
    }
    return '';
  }

  fecha(valor: Date): string {
    return formatearFecha(valor, this.idioma(), true);
  }

  private filtro(): FiltroAuditoria {
    const tabla = this.tabla();
    const operacion = this.operacion();
    return { tabla: tabla === 'todos' ? null : tabla, operacion: operacion === 'todos' ? null : operacion };
  }
}
