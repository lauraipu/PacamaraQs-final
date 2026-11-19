import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline, refreshOutline } from 'ionicons/icons';
import { AdminRepository } from '../data-access/admin.repository';
import {
  AdminResumen, ESTADOS_SESION, FORMATOS_SESION, LIMITE_BD_BYTES
} from '../data-access/admin.models';
import { formatearDiaCorto, megabytes } from '@shared/utils/formato';

addIcons({ refreshOutline, cloudOfflineOutline });

/** Pestaña "Resumen": indicadores generales, actividad y uso de la base de datos. */
@Component({
  selector: 'app-admin-resumen',
  standalone: true,
  imports: [IonButton, IonIcon, IonSpinner, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./admin-comun.scss', './admin-resumen.component.scss'],
  template: `
    <div class="ad-meta-lista">
      <span>{{ 'admin.resumen.titulo' | transloco }}</span>
      <ion-button fill="clear" size="small" (click)="cargar()" [disabled]="cargando()">
        <ion-icon slot="start" name="refresh-outline" aria-hidden="true"></ion-icon>
        {{ 'admin.actualizar' | transloco }}
      </ion-button>
    </div>

    @if (resumen(); as r) {
      <section class="rs-kpis" [attr.aria-label]="'admin.resumen.titulo' | transloco">
        <article class="ad-card rs-kpi">
          <span class="rs-kpi__label">{{ 'admin.resumen.usuarios' | transloco }}</span>
          <strong class="rs-kpi__valor">{{ r.usuarios }}</strong>
          <span class="rs-kpi__sub">{{ 'admin.resumen.nuevos_semana' | transloco: { n: r.usuariosNuevos7d } }}</span>
        </article>
        <article class="ad-card rs-kpi">
          <span class="rs-kpi__label">{{ 'admin.resumen.activos' | transloco }}</span>
          <strong class="rs-kpi__valor">{{ r.activos7d }}</strong>
          <span class="rs-kpi__sub">{{ 'admin.resumen.activos_sub' | transloco }}</span>
        </article>
        <article class="ad-card rs-kpi">
          <span class="rs-kpi__label">{{ 'admin.resumen.sesiones' | transloco }}</span>
          <strong class="rs-kpi__valor">{{ r.sesiones }}</strong>
          <span class="rs-kpi__sub">{{ 'admin.resumen.en_progreso_sub' | transloco: { n: r.sesionesPorEstado.en_progreso } }}</span>
        </article>
        <article class="ad-card rs-kpi">
          <span class="rs-kpi__label">{{ 'admin.resumen.evaluaciones' | transloco }}</span>
          <strong class="rs-kpi__valor">{{ r.evaluaciones }}</strong>
          <span class="rs-kpi__sub">{{ 'admin.resumen.evaluaciones_sub' | transloco: { n: r.evaluaciones7d } }}</span>
        </article>
        <article class="ad-card rs-kpi">
          <span class="rs-kpi__label">{{ 'admin.resumen.escaneos' | transloco }}</span>
          <strong class="rs-kpi__valor">{{ r.escaneos7d }}</strong>
          <span class="rs-kpi__sub">{{ 'admin.resumen.escaneos_sub' | transloco: { n: r.escaneos24h } }}</span>
        </article>
        <article class="ad-card rs-kpi">
          <span class="rs-kpi__label">{{ 'admin.resumen.base_datos' | transloco }}</span>
          <strong class="rs-kpi__valor">{{ porcentajeBd() }}%</strong>
          <span class="rs-kpi__sub">{{ 'admin.resumen.base_datos_sub' | transloco: { usado: mb(r.tamanoBdBytes), limite: mb(limiteBd) } }}</span>
          <div class="rs-medidor" role="progressbar" [attr.aria-valuenow]="porcentajeBd()" aria-valuemin="0" aria-valuemax="100">
            <span [style.width.%]="porcentajeBd()" [class.rs-medidor--alto]="porcentajeBd() >= 80"></span>
          </div>
        </article>
      </section>

      <div class="rs-grid">
        <section class="ad-card rs-actividad">
          <h2 class="ad-card__titulo">{{ 'admin.resumen.actividad' | transloco }}</h2>
          <div class="rs-leyenda" aria-hidden="true">
            <span><i class="rs-punto rs-punto--eval"></i>{{ 'admin.resumen.leyenda_evaluaciones' | transloco }}</span>
            <span><i class="rs-punto rs-punto--ses"></i>{{ 'admin.resumen.leyenda_sesiones' | transloco }}</span>
          </div>
          <ol class="rs-barras">
            @for (d of r.actividad14d; track d.dia.getTime()) {
              <li class="rs-barra" [attr.aria-label]="'admin.resumen.actividad_aria' | transloco: { dia: dia(d.dia), e: d.evaluaciones, s: d.sesiones }"
                [title]="dia(d.dia) + ' · ' + d.evaluaciones + ' / ' + d.sesiones">
                <div class="rs-barra__pila">
                  <span class="rs-barra__eval" [style.height.%]="alto(d.evaluaciones)"></span>
                  <span class="rs-barra__ses" [style.height.%]="alto(d.sesiones)"></span>
                </div>
                <span class="rs-barra__dia">{{ d.dia.getDate() }}</span>
              </li>
            }
          </ol>
        </section>

        <section class="ad-card">
          <h2 class="ad-card__titulo">{{ 'admin.resumen.por_estado' | transloco }}</h2>
          <ul class="rs-dist">
            @for (e of estados; track e) {
              <li>
                <span class="rs-dist__label">{{ 'admin.estados.' + e | transloco }}</span>
                <span class="rs-dist__barra"><span [style.width.%]="parte(r.sesionesPorEstado[e], r.sesiones)"></span></span>
                <strong>{{ r.sesionesPorEstado[e] }}</strong>
              </li>
            }
          </ul>

          <h2 class="ad-card__titulo rs-sep">{{ 'admin.resumen.por_formato' | transloco }}</h2>
          <ul class="rs-dist">
            @for (f of formatos; track f) {
              <li>
                <span class="rs-dist__label">{{ 'admin.formatos.' + f | transloco }}</span>
                <span class="rs-dist__barra"><span [style.width.%]="parte(r.sesionesPorFormato[f], r.sesiones)"></span></span>
                <strong>{{ r.sesionesPorFormato[f] }}</strong>
              </li>
            }
          </ul>
        </section>
      </div>
    } @else if (error()) {
      <div class="ad-estado" role="alert">
        <ion-icon name="cloud-offline-outline" aria-hidden="true"></ion-icon>
        <p>{{ 'admin.error_carga' | transloco }}</p>
        <ion-button fill="outline" (click)="cargar()">{{ 'admin.reintentar' | transloco }}</ion-button>
      </div>
    } @else {
      <div class="ad-estado" role="status"><ion-spinner name="crescent"></ion-spinner><p>{{ 'admin.cargando' | transloco }}</p></div>
    }
  `
})
export class AdminResumenComponent implements OnInit {
  private readonly repo = inject(AdminRepository);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly estados = ESTADOS_SESION;
  readonly formatos = FORMATOS_SESION;
  readonly limiteBd = LIMITE_BD_BYTES;

  readonly resumen = signal<AdminResumen | null>(null);
  readonly cargando = signal(false);
  readonly error = signal(false);

  readonly porcentajeBd = computed(() => {
    const r = this.resumen();
    return r ? Math.min(100, Math.round((r.tamanoBdBytes / LIMITE_BD_BYTES) * 1000) / 10) : 0;
  });

  private readonly maximoDia = computed(() =>
    Math.max(1, ...(this.resumen()?.actividad14d ?? []).flatMap(d => [d.evaluaciones, d.sesiones])));

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set(false);
    try {
      this.resumen.set(await this.repo.resumen());
    } catch (error) {
      console.error('[Admin] resumen', error);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  alto(valor: number): number {
    return valor ? Math.max(4, (valor / this.maximoDia()) * 100) : 0;
  }

  parte(valor: number, total: number): number {
    return total ? (valor / total) * 100 : 0;
  }

  dia(fecha: Date): string {
    return formatearDiaCorto(fecha, this.idioma());
  }

  mb(bytes: number): string {
    return megabytes(bytes);
  }
}
