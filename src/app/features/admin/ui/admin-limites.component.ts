import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton, IonIcon, IonInput, IonSpinner, IonTextarea, IonToggle } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline, pauseCircleOutline, refreshOutline, timeOutline } from 'ionicons/icons';
import { AvisosService } from '@core/errores/avisos.service';
import { TrPipe } from '@core/i18n/tr';
import { AdminRepository } from '../data-access/admin.repository';
import {
  AdminConfiguracion, CampoNumericoConfiguracion, ConfiguracionApp, DIAS_PAUSA_PROGRAMADA,
  LARGO_MAXIMO_MENSAJE_PAUSA, LARGO_MINIMO_MENSAJE_PAUSA, RANGOS_CONFIGURACION
} from '../models/admin.models';
import { formatearFecha, megabytes } from '@shared/utils/formato';

addIcons({ refreshOutline, cloudOfflineOutline, pauseCircleOutline, timeOutline });

const MB = 1024 * 1024;

/** 'YYYY-MM-DDTHH:mm' en hora local (lo que espera un input datetime-local). */
function aFechaLocal(fecha: Date | null): string {
  if (!fecha) return '';
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

function deFechaLocal(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function iguales(a: ConfiguracionApp, b: ConfiguracionApp): boolean {
  return a.pausada === b.pausada
    && (a.pausarDesde?.getTime() ?? null) === (b.pausarDesde?.getTime() ?? null)
    && a.mensajePausa.trim() === b.mensajePausa.trim()
    && a.registrosAbiertos === b.registrosAbiertos
    && a.maxSesionesAbiertas === b.maxSesionesAbiertas
    && a.maxEscaneosHora === b.maxEscaneosHora
    && a.limiteBdMb === b.limiteBdMb;
}

/**
 * Pestaña "Uso y límites": medidores de consumo y la configuración que
 * protege el plan gratuito (pausa, registros, máximos). Todo se valida y se
 * aplica en el servidor; aquí solo se edita y se muestra.
 */
@Component({
  selector: 'app-admin-limites',
  standalone: true,
  imports: [IonButton, IonIcon, IonInput, IonSpinner, IonTextarea, IonToggle, TranslocoPipe, TrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./admin-comun.scss', './admin-limites.component.scss'],
  template: `
    <div class="ad-meta-lista">
      <span>{{ 'admin.limites.titulo' | transloco }}</span>
      <ion-button fill="clear" size="small" (click)="cargar()" [disabled]="cargando() || guardando()">
        <ion-icon slot="start" name="refresh-outline" aria-hidden="true"></ion-icon>
        {{ 'admin.actualizar' | transloco }}
      </ion-button>
    </div>

    @if (datos(); as d) {
      @if (d.uso.enPausa) {
        <div class="lm-aviso lm-aviso--pausa" role="status">
          <ion-icon name="pause-circle-outline" aria-hidden="true"></ion-icon>
          <span>{{ 'admin.limites.estado_en_pausa' | transloco }}</span>
        </div>
      } @else if (pausaFutura(); as f) {
        <div class="lm-aviso" role="status">
          <ion-icon name="time-outline" aria-hidden="true"></ion-icon>
          <span>{{ 'admin.limites.estado_programada' | transloco: { fecha: fecha(f) } }}</span>
        </div>
      }

      <section class="lm-medidores" [attr.aria-label]="'admin.limites.uso' | transloco">
        <article class="ad-card lm-medidor">
          <span class="lm-medidor__label">{{ 'admin.limites.base_datos' | transloco }}</span>
          <strong class="lm-medidor__valor">{{ mb(d.uso.tamanoBdBytes) }}</strong>
          <span class="lm-medidor__sub">{{ 'admin.limites.de_limite' | transloco: { limite: d.configuracion.limiteBdMb + ' MB' } }}</span>
          <div class="lm-barra" role="progressbar" [attr.aria-valuenow]="porcentajeBd()" aria-valuemin="0" aria-valuemax="100">
            <span [style.width.%]="porcentajeBd()" [class.lm-barra--alto]="porcentajeBd() >= 80"></span>
          </div>
        </article>
        <article class="ad-card lm-medidor">
          <span class="lm-medidor__label">{{ 'admin.limites.sesiones_abiertas' | transloco }}</span>
          <strong class="lm-medidor__valor">{{ d.uso.sesionesAbiertas }}</strong>
          <span class="lm-medidor__sub">{{ 'admin.limites.por_organizador' | transloco: { n: d.configuracion.maxSesionesAbiertas } }}</span>
        </article>
        <article class="ad-card lm-medidor">
          <span class="lm-medidor__label">{{ 'admin.limites.escaneos_24h' | transloco }}</span>
          <strong class="lm-medidor__valor">{{ d.uso.escaneos24h }}</strong>
          <span class="lm-medidor__sub">
            @if (d.configuracion.maxEscaneosHora === 0) { {{ 'admin.limites.escaner_apagado' | transloco }} }
            @else { {{ 'admin.limites.por_usuario_hora' | transloco: { n: d.configuracion.maxEscaneosHora } }} }
          </span>
        </article>
        <article class="ad-card lm-medidor">
          <span class="lm-medidor__label">{{ 'admin.limites.usuarios_activos' | transloco }}</span>
          <strong class="lm-medidor__valor">{{ d.uso.usuarios }}</strong>
          <span class="lm-medidor__sub">{{ 'admin.limites.evaluaciones_total' | transloco: { n: d.uso.evaluaciones } }}</span>
        </article>
      </section>

      @if (form(); as f) {
        <form class="lm-form" (submit)="$event.preventDefault(); guardar()">
          <section class="ad-card lm-seccion">
            <h2 class="ad-card__titulo">{{ 'admin.limites.pausa' | transloco }}</h2>
            <ion-toggle class="lm-toggle" justify="space-between" [checked]="f.pausada"
              (ionChange)="cambiar('pausada', $event.detail.checked)">{{ 'admin.limites.pausar_ahora' | transloco }}</ion-toggle>
            <p class="lm-ayuda">{{ 'admin.limites.pausar_ahora_ayuda' | transloco }}</p>

            <ion-input class="custom-input" fill="outline" labelPlacement="stacked" type="datetime-local"
              [label]="'admin.limites.pausar_desde' | transloco" [value]="fechaLocal(f.pausarDesde)"
              (ionChange)="cambiarFecha($any($event).detail.value)"></ion-input>
            <div class="lm-acciones-fecha">
              <ion-button fill="outline" size="small" type="button" (click)="programarEnDias()">
                {{ 'admin.limites.en_dias' | transloco: { n: diasPausa } }}
              </ion-button>
              @if (f.pausarDesde) {
                <ion-button fill="clear" size="small" type="button" (click)="cambiar('pausarDesde', null)">
                  {{ 'admin.limites.quitar_fecha' | transloco }}
                </ion-button>
              }
            </div>
            <p class="lm-ayuda">{{ 'admin.limites.pausar_desde_ayuda' | transloco }}</p>

            <ion-textarea class="custom-input" fill="outline" labelPlacement="stacked" [autoGrow]="true" [rows]="2"
              [label]="'admin.limites.mensaje' | transloco" [value]="f.mensajePausa"
              [maxlength]="largoMaximo" [counter]="true"
              [errorText]="'admin.limites.mensaje_invalido' | transloco: { min: largoMinimo, max: largoMaximo }"
              [class.ion-invalid]="!mensajeValido()" [class.ion-touched]="!mensajeValido()"
              (ionInput)="cambiar('mensajePausa', $any($event).detail.value ?? '')"></ion-textarea>
            <p class="lm-ayuda">{{ 'admin.limites.mensaje_vista_previa' | transloco }} {{ f.mensajePausa | tr }}</p>
          </section>

          <section class="ad-card lm-seccion">
            <h2 class="ad-card__titulo">{{ 'admin.limites.acceso' | transloco }}</h2>
            <ion-toggle class="lm-toggle" justify="space-between" [checked]="f.registrosAbiertos"
              (ionChange)="cambiar('registrosAbiertos', $event.detail.checked)">{{ 'admin.limites.registros_abiertos' | transloco }}</ion-toggle>
            <p class="lm-ayuda">{{ 'admin.limites.registros_ayuda' | transloco }}</p>
          </section>

          <section class="ad-card lm-seccion">
            <h2 class="ad-card__titulo">{{ 'admin.limites.maximos' | transloco }}</h2>
            @for (c of camposNumericos; track c) {
              <ion-input class="custom-input" fill="outline" labelPlacement="stacked" type="number" inputmode="numeric"
                [label]="'admin.limites.campos.' + c | transloco" [value]="textoNumero(f[c])"
                [min]="rangos[c].min" [max]="rangos[c].max" step="1"
                [helperText]="'admin.limites.ayuda.' + c | transloco: rangos[c]"
                [errorText]="'admin.limites.fuera_de_rango' | transloco: rangos[c]"
                [class.ion-invalid]="!numeroValido(c)" [class.ion-touched]="!numeroValido(c)"
                (ionInput)="cambiarNumero(c, $any($event).detail.value)"></ion-input>
            }
          </section>

          <div class="lm-pie">
            @if (d.actualizadoEn) {
              <span class="lm-ayuda">{{ 'admin.limites.actualizado' | transloco: { fecha: fecha(d.actualizadoEn) } }}</span>
            }
            <div class="lm-pie__botones">
              <ion-button fill="outline" type="button" [disabled]="!hayCambios() || guardando()" (click)="descartar()">
                {{ 'admin.limites.descartar' | transloco }}
              </ion-button>
              <ion-button class="primary-btn" type="submit" [disabled]="!hayCambios() || !esValido() || guardando()">
                @if (guardando()) { <ion-spinner name="crescent"></ion-spinner> } @else { {{ 'admin.limites.guardar' | transloco }} }
              </ion-button>
            </div>
          </div>
        </form>
      }
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
export class AdminLimitesComponent implements OnInit {
  private readonly repo = inject(AdminRepository);
  private readonly avisos = inject(AvisosService);
  private readonly transloco = inject(TranslocoService);
  private readonly idioma = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  readonly camposNumericos: readonly CampoNumericoConfiguracion[] = ['maxSesionesAbiertas', 'maxEscaneosHora', 'limiteBdMb'];
  readonly rangos = RANGOS_CONFIGURACION;
  readonly largoMinimo = LARGO_MINIMO_MENSAJE_PAUSA;
  readonly largoMaximo = LARGO_MAXIMO_MENSAJE_PAUSA;
  readonly diasPausa = DIAS_PAUSA_PROGRAMADA;

  readonly datos = signal<AdminConfiguracion | null>(null);
  /** Copia editable; se compara con `datos().configuracion` para saber si hay cambios. */
  readonly form = signal<ConfiguracionApp | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal(false);

  readonly porcentajeBd = computed(() => {
    const d = this.datos();
    return d ? this.porcentaje(d.uso.tamanoBdBytes, d.configuracion.limiteBdMb * MB) : 0;
  });

  /** Pausa programada guardada que aún no empieza. */
  readonly pausaFutura = computed(() => {
    const desde = this.datos()?.configuracion.pausarDesde;
    return desde && desde.getTime() > Date.now() ? desde : null;
  });

  readonly mensajeValido = computed(() => {
    const largo = this.form()?.mensajePausa.trim().length ?? 0;
    return largo >= LARGO_MINIMO_MENSAJE_PAUSA && largo <= LARGO_MAXIMO_MENSAJE_PAUSA;
  });

  readonly esValido = computed(() => this.mensajeValido() && this.camposNumericos.every(c => this.numeroValido(c)));

  readonly hayCambios = computed(() => {
    const d = this.datos();
    const f = this.form();
    return !!d && !!f && !iguales(d.configuracion, f);
  });

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set(false);
    try {
      const datos = await this.repo.obtenerConfiguracion();
      this.datos.set(datos);
      this.form.set({ ...datos.configuracion });
    } catch (error) {
      console.error('[Admin] configuración', error);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  cambiar<K extends keyof ConfiguracionApp>(campo: K, valor: ConfiguracionApp[K]): void {
    this.form.update(f => (f ? { ...f, [campo]: valor } : f));
  }

  cambiarNumero(campo: CampoNumericoConfiguracion, valor: string | number | null | undefined): void {
    const texto = String(valor ?? '').trim();
    this.cambiar(campo, texto === '' ? Number.NaN : Number(texto));
  }

  cambiarFecha(valor: string | null | undefined): void {
    this.cambiar('pausarDesde', deFechaLocal(valor));
  }

  /** Atajo para la semana de prueba: pausa programada dentro de N días a esta misma hora. */
  programarEnDias(): void {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + DIAS_PAUSA_PROGRAMADA);
    fecha.setSeconds(0, 0);
    this.cambiar('pausarDesde', fecha);
  }

  numeroValido(campo: CampoNumericoConfiguracion): boolean {
    const valor = this.form()?.[campo];
    const { min, max } = RANGOS_CONFIGURACION[campo];
    return typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max;
  }

  descartar(): void {
    const d = this.datos();
    if (d) this.form.set({ ...d.configuracion });
  }

  async guardar(): Promise<void> {
    const f = this.form();
    const d = this.datos();
    if (!f || !d || !this.hayCambios() || !this.esValido() || this.guardando()) return;

    const pausaNueva = f.pausada && !d.configuracion.pausada;
    const ok = await this.avisos.confirmar({
      titulo: 'admin.limites.confirmar_titulo',
      mensaje: pausaNueva ? 'admin.limites.confirmar_pausa' : 'admin.limites.confirmar_texto',
      confirmar: 'admin.limites.guardar',
      peligro: pausaNueva
    });
    if (!ok) return;

    this.guardando.set(true);
    try {
      await this.repo.guardarConfiguracion({ ...f, mensajePausa: f.mensajePausa.trim() });
      await this.avisos.exito('admin.limites.guardado');
      this.guardando.set(false);
      await this.cargar();
    } catch (error) {
      await this.avisos.error(error);
    } finally {
      this.guardando.set(false);
    }
  }

  textoNumero(valor: number): string {
    return Number.isFinite(valor) ? String(valor) : '';
  }

  fechaLocal(fecha: Date | null): string {
    return aFechaLocal(fecha);
  }

  fecha(valor: Date): string {
    return formatearFecha(valor, this.idioma(), true);
  }

  mb(bytes: number): string {
    return megabytes(bytes);
  }

  private porcentaje(valor: number, limite: number): number {
    return limite > 0 ? Math.min(100, Math.round((valor / limite) * 1000) / 10) : 0;
  }
}
