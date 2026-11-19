import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  IonButton, IonIcon, IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonSpinner
} from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  cloudOfflineOutline, refreshOutline, searchOutline, shieldCheckmarkOutline, warningOutline
} from 'ionicons/icons';
import { AvisosService } from '../../../core/avisos/avisos.service';
import { AuthService } from '../../../core/services/auth';
import { AdminRepository } from '../data-access/admin.repository';
import { AdminUsuario, FiltroUsuarios, RolAdminVista } from '../data-access/admin.models';
import { formatearFecha, iniciales } from './formato';
import { ListaPaginada } from './lista-paginada';

addIcons({ refreshOutline, cloudOfflineOutline, searchOutline, shieldCheckmarkOutline, warningOutline });

type FiltroRol = 'todos' | RolAdminVista;

/** Pestaña "Usuarios": búsqueda, filtro por rol y cambio de rol con confirmación. */
@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [IonButton, IonIcon, IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonSpinner, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./admin-comun.scss', './admin-usuarios.component.scss'],
  template: `
    <div class="ad-filtros">
      <ion-searchbar [debounce]="400" [placeholder]="'admin.buscar_usuarios' | transloco"
        [value]="busqueda()" (ionInput)="buscar($any($event).detail.value)"></ion-searchbar>
      <ion-segment [value]="rol()" (ionChange)="cambiarFiltroRol($any($event).detail.value)">
        <ion-segment-button value="todos"><ion-label>{{ 'admin.todos' | transloco }}</ion-label></ion-segment-button>
        <ion-segment-button value="catador"><ion-label>{{ 'admin.roles.catadores' | transloco }}</ion-label></ion-segment-button>
        <ion-segment-button value="administrador"><ion-label>{{ 'admin.roles.administradores' | transloco }}</ion-label></ion-segment-button>
      </ion-segment>
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
        @for (u of lista.filas(); track u.id) {
          <li class="ad-fila us-fila">
            <div class="us-cabeza">
              <span class="us-avatar" aria-hidden="true">{{ inicialesDe(u.nombre) }}</span>
              <div class="us-ident">
                <p class="ad-fila__titulo">{{ u.nombre }}</p>
                <p class="ad-fila__sub">{{ u.email }}</p>
              </div>
              <div class="ad-chips">
                <span class="ad-chip" [class.ad-chip--oscuro]="u.rol === 'administrador'">{{ 'admin.roles.' + u.rol | transloco }}</span>
                @if (u.tieneDosPasos) {
                  <span class="ad-chip ad-chip--ok"><ion-icon name="shield-checkmark-outline" aria-hidden="true"></ion-icon>{{ 'admin.usuarios.dos_pasos' | transloco }}</span>
                } @else if (u.rol === 'administrador') {
                  <span class="ad-chip ad-chip--alerta"><ion-icon name="warning-outline" aria-hidden="true"></ion-icon>{{ 'admin.usuarios.sin_dos_pasos' | transloco }}</span>
                }
                @if (u.id === miId()) {
                  <span class="ad-chip">{{ 'admin.usuarios.tu' | transloco }}</span>
                }
              </div>
            </div>

            <dl class="ad-datos">
              <div><dt>{{ 'admin.usuarios.organizadas' | transloco }}</dt><dd>{{ u.sesionesOrganizadas }}</dd></div>
              <div><dt>{{ 'admin.usuarios.evaluaciones' | transloco }}</dt><dd>{{ u.evaluaciones }}</dd></div>
              <div><dt>{{ 'admin.usuarios.ultimo_acceso' | transloco }}</dt><dd>{{ u.ultimoAcceso ? fecha(u.ultimoAcceso, true) : ('admin.usuarios.nunca' | transloco) }}</dd></div>
              <div><dt>{{ 'admin.usuarios.alta' | transloco }}</dt><dd>{{ fecha(u.creadoEn) }}</dd></div>
            </dl>

            @if (u.id !== miId()) {
              <div class="us-acciones">
                <ion-button size="small" fill="outline" [disabled]="cambiando() === u.id" (click)="cambiarRol(u)">
                  @if (cambiando() === u.id) {
                    <ion-spinner name="crescent"></ion-spinner>
                  } @else {
                    {{ (u.rol === 'administrador' ? 'admin.usuarios.quitar_admin' : 'admin.usuarios.hacer_admin') | transloco }}
                  }
                </ion-button>
              </div>
            }
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
export class AdminUsuariosComponent implements OnInit {
  private readonly repo = inject(AdminRepository);
  private readonly avisos = inject(AvisosService);
  private readonly transloco = inject(TranslocoService);
  private readonly auth = inject(AuthService);
  private readonly idioma = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly lista = new ListaPaginada<AdminUsuario, FiltroUsuarios>((f, l, d) => this.repo.listarUsuarios(f, l, d));
  readonly busqueda = signal('');
  readonly rol = signal<FiltroRol>('todos');
  readonly cambiando = signal<string | null>(null);
  readonly miId = () => this.auth.usuario()?.id ?? null;

  ngOnInit(): void {
    void this.recargar();
  }

  buscar(valor: string | null | undefined): void {
    this.busqueda.set(valor ?? '');
    void this.recargar();
  }

  cambiarFiltroRol(valor: FiltroRol): void {
    this.rol.set(valor);
    void this.recargar();
  }

  recargar(): Promise<void> {
    return this.lista.reiniciar(this.filtro());
  }

  masResultados(): Promise<void> {
    return this.lista.siguiente(this.filtro());
  }

  async cambiarRol(usuario: AdminUsuario): Promise<void> {
    const nuevo: RolAdminVista = usuario.rol === 'administrador' ? 'catador' : 'administrador';
    const promover = nuevo === 'administrador';
    const ok = await this.avisos.confirmar({
      titulo: promover ? 'admin.usuarios.confirmar_admin_titulo' : 'admin.usuarios.confirmar_quitar_titulo',
      mensaje: promover ? 'admin.usuarios.confirmar_admin_texto' : 'admin.usuarios.confirmar_quitar_texto',
      confirmar: 'admin.usuarios.confirmar',
      peligro: true,
      params: { nombre: usuario.nombre }
    });
    if (!ok) return;

    this.cambiando.set(usuario.id);
    try {
      await this.repo.cambiarRol(usuario.id, nuevo);
      if (this.rol() !== 'todos') {
        await this.recargar();
      } else {
        this.lista.actualizar(f => f.id === usuario.id, f => ({ ...f, rol: nuevo }));
      }
      await this.avisos.exito('admin.usuarios.rol_actualizado', {
        nombre: usuario.nombre,
        rol: this.transloco.translate(`admin.roles.${nuevo}`)
      });
    } catch (error) {
      await this.avisos.error(error);
    } finally {
      this.cambiando.set(null);
    }
  }

  fecha(valor: Date, conHora = false): string {
    return formatearFecha(valor, this.idioma(), conHora);
  }

  inicialesDe(nombre: string): string {
    return iniciales(nombre);
  }

  private filtro(): FiltroUsuarios {
    const rol = this.rol();
    return { busqueda: this.busqueda(), rol: rol === 'todos' ? null : rol };
  }
}
