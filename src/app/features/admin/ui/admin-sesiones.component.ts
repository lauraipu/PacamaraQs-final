import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton, IonIcon, IonSearchbar, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline, refreshOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { AvisosService } from '@core/errores/avisos.service';
import { AdminRepository } from '../data-access/admin.repository';
import {
  AdminSesion, ESTADOS_ELIMINABLES, ESTADOS_SESION, EstadoSesionAdmin, FiltroSesiones
} from '../data-access/admin.models';
import { formatearFecha } from './formato';
import { ListaPaginada } from './lista-paginada';

addIcons({ refreshOutline, cloudOfflineOutline, searchOutline, trashOutline });

/**
 * Pestaña "Sesiones": todas las cataciones con su estado y avance.
 * Solo metadatos: el administrador no ve aquí puntajes individuales.
 */
@Component({
  selector: 'app-admin-sesiones',
  standalone: true,
  imports: [IonButton, IonIcon, IonSearchbar, IonSelect, IonSelectOption, IonSpinner, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./admin-comun.scss'],
  styles: [`
    .se-cabeza { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .se-ident { min-width: 0; flex: 1 1 220px; }
    .se-lado { display: flex; align-items: center; gap: 4px; }
    .se-eliminar {
      --color: var(--app-error); --padding-start: 0; --padding-end: 0;
      width: 40px; height: 40px; margin: 0;
    }
    .se-eliminar ion-icon { font-size: 20px; }
  `],
  template: `
    <div class="ad-filtros">
      <ion-searchbar [debounce]="400" [placeholder]="'admin.buscar_sesiones' | transloco"
        [value]="busqueda()" (ionInput)="buscar($any($event).detail.value)"></ion-searchbar>
      <ion-select interface="popover" [value]="estado()" (ionChange)="cambiarEstado($any($event).detail.value)"
        [label]="'admin.sesiones.filtro_estado' | transloco" labelPlacement="start">
        <ion-select-option value="todos">{{ 'admin.todos' | transloco }}</ion-select-option>
        @for (e of estados; track e) {
          <ion-select-option [value]="e">{{ 'admin.estados.' + e | transloco }}</ion-select-option>
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
        @for (s of lista.filas(); track s.id) {
          <li class="ad-fila">
            <div class="se-cabeza">
              <div class="se-ident">
                <p class="ad-fila__titulo">{{ s.nombre }}</p>
                <p class="ad-fila__sub">{{ 'admin.sesiones.organizador' | transloco }}: {{ s.organizador }}</p>
              </div>
              <div class="se-lado">
                <div class="ad-chips">
                  <span class="ad-chip">{{ 'admin.formatos.' + s.formato | transloco }}</span>
                  @if (s.esPersonal) { <span class="ad-chip">{{ 'admin.sesiones.personal' | transloco }}</span> }
                  <span [class]="'ad-chip ' + claseEstado(s.estado)">{{ 'admin.estados.' + s.estado | transloco }}</span>
                </div>
                @if (sePuedeEliminar(s)) {
                  <ion-button fill="clear" size="small" class="se-eliminar" [disabled]="eliminando() === s.id"
                    (click)="eliminar(s)" [attr.aria-label]="'admin.sesiones.eliminar_aria' | transloco: { nombre: s.nombre }">
                    @if (eliminando() === s.id) {
                      <ion-spinner name="crescent"></ion-spinner>
                    } @else {
                      <ion-icon slot="icon-only" name="trash-outline" aria-hidden="true"></ion-icon>
                    }
                  </ion-button>
                }
              </div>
            </div>
            <dl class="ad-datos">
              <div><dt>{{ 'admin.sesiones.codigo' | transloco }}</dt><dd class="ad-mono">{{ s.codigo ?? '—' }}</dd></div>
              <div><dt>{{ 'admin.sesiones.catadores' | transloco }}</dt><dd>{{ s.listos }} / {{ s.esPersonal ? 1 : s.catadoresObjetivo }}</dd></div>
              <div><dt>{{ 'admin.sesiones.muestras' | transloco }}</dt><dd>{{ s.numeroMuestras }}</dd></div>
              <div><dt>{{ 'admin.sesiones.evaluaciones' | transloco }}</dt><dd>{{ s.evaluaciones }}</dd></div>
              <div><dt>{{ 'admin.sesiones.creada' | transloco }}</dt><dd>{{ fecha(s.creadoEn) }}</dd></div>
            </dl>
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
export class AdminSesionesComponent implements OnInit {
  private readonly repo = inject(AdminRepository);
  private readonly avisos = inject(AvisosService);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly estados = ESTADOS_SESION;
  readonly lista = new ListaPaginada<AdminSesion, FiltroSesiones>((f, l, d) => this.repo.listarSesiones(f, l, d));
  readonly busqueda = signal('');
  readonly estado = signal<'todos' | EstadoSesionAdmin>('todos');
  readonly eliminando = signal<string | null>(null);

  ngOnInit(): void {
    void this.recargar();
  }

  buscar(valor: string | null | undefined): void {
    this.busqueda.set(valor ?? '');
    void this.recargar();
  }

  cambiarEstado(valor: 'todos' | EstadoSesionAdmin): void {
    this.estado.set(valor);
    void this.recargar();
  }

  recargar(): Promise<void> {
    return this.lista.reiniciar(this.filtro());
  }

  masResultados(): Promise<void> {
    return this.lista.siguiente(this.filtro());
  }

  /** Las completadas y canceladas son historial: no se ofrecen para borrar. */
  sePuedeEliminar(sesion: AdminSesion): boolean {
    return ESTADOS_ELIMINABLES.includes(sesion.estado);
  }

  async eliminar(sesion: AdminSesion): Promise<void> {
    const ok = await this.avisos.confirmar({
      titulo: 'admin.eliminar.titulo',
      mensaje: 'admin.eliminar.sesion_texto',
      confirmar: 'admin.eliminar.confirmar',
      peligro: true,
      params: { nombre: sesion.nombre }
    });
    if (!ok) return;

    this.eliminando.set(sesion.id);
    try {
      await this.repo.eliminarSesion(sesion.id);
      await this.recargar();
      await this.avisos.exito('admin.eliminar.sesion_eliminada', { nombre: sesion.nombre });
    } catch (error) {
      await this.avisos.error(error);
    } finally {
      this.eliminando.set(null);
    }
  }

  claseEstado(estado: EstadoSesionAdmin): string {
    switch (estado) {
      case 'en_progreso': return 'ad-chip--oscuro';
      case 'completada': return 'ad-chip--ok';
      case 'cancelada': return 'ad-chip--error';
      default: return 'ad-chip--alerta';
    }
  }

  fecha(valor: Date): string {
    return formatearFecha(valor, this.idioma());
  }

  private filtro(): FiltroSesiones {
    const estado = this.estado();
    return { busqueda: this.busqueda(), estado: estado === 'todos' ? null : estado };
  }
}
