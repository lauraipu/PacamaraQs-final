import {
  afterNextRender, Component, computed, ElementRef, inject, Injector, OnInit, signal, viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonAccordion, IonAccordionGroup, IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardContent,
  IonCheckbox, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonModal, IonRow, IonSegment,
  IonSegmentButton, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToggle, IonToolbar, ActionSheetController, NavController,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, closeOutline, documentTextOutline, downloadOutline, gridOutline, hourglassOutline, lockClosedOutline,
  medalOutline, ribbonOutline, trophyOutline
} from 'ionicons/icons';
import { ETIQUETAS_HEDONICAS } from '../../../core/cva/cva';
import {
  BOCA_SCA, circuloMarcado, consolidarFichas, DEFECTOS_SCA, DESCRIPTORES_SCA, etiquetaCalidad, FormatoHoja,
  AtributoHoja, GUSTOS_SCA, HojaSca, leerFichaSca, puntajePanel
} from '../../../core/cva/hoja-sca';
import { FormatoCva, getFormatoById } from '../../../core/models/sesion.model';
import {
  AtributoCva, CupperResultSummary, SampleConsolidatedResult, SessionResults, ValorAtributo
} from '../../../core/models/session-results.model';
import { ImpresionService } from '../../../core/services/impresion';
import { ResultsService } from '../../../core/services/results';
import { codigoDeError, mensajeDeError } from '../../../core/utils/errores';
import { CupperResultCardComponent } from '../../../shared/components/cupper-result-card/cupper-result-card.component';
import {
  FormatoReporteSca, ScaReportTemplateComponent
} from '../../../shared/components/sca-report-template/sca-report-template.component';

export interface Clasificacion {
  etiqueta: string;
  color: string;
  fondo: string;
}

export interface FilaRanking extends SampleConsolidatedResult {
  posicion: number;
  clasificacion: Clasificacion;
}

export interface AtributoFicha {
  clave: AtributoCva;
  etiqueta: string;
  intensidad: number | null;
  calidad: number | null;
}

export interface FichaReporte {
  numeroMuestra: number;
  puntaje: number;
  /** La RPC devolvió puntaje NULL (ficha escaneada con calidades sin leer). */
  sinPuntaje: boolean;
  /** Notas y descriptores revisados en el modal del escáner (evaluaciones.notas). */
  notas: string;
  descriptores: string[];
  tazasNoUniformes: number;
  tazasDefectuosas: number;
  impresionGlobal: number | null;
  atributos: AtributoFicha[];
  clasificacion: Clasificacion;
}

export interface BarraValor {
  clave: string;
  etiqueta: string;
  valor: number | null;
  /** Ancho de la barra, 0–100. */
  porcentaje: number;
}

export interface FilaHedonica {
  numeroMuestra: number;
  posicion: number;
  totalVotos: number;
  /** Promedio de la Impresión Global (1–9). */
  promedio: number | null;
  etiqueta: string;
  /** Votos por valor de la escala, de 9 a 1. */
  distribucion: { valor: number; votos: number; porcentaje: number; etiqueta: string }[];
  /** Promedio de calidad (1–9) por atributo. */
  atributos: BarraValor[];
}

export interface PerfilDescriptivo {
  numeroMuestra: number;
  fichas: number;
  /** Intensidad promedio (0–15) por atributo. */
  atributos: (BarraValor & { respuestas: number })[];
}

export interface PuntoMedidor { x: number; y: number; }
export interface ArcoMedidor { d: string; clase: string; }
export type ModoExportacion = 'panel' | 'catador';

/* ── Gráficas de radar (SVG puro) ─────────────────────────────────────── */
export interface EjeRadar { x: number; y: number; lx: number; ly: number; etiqueta: string; anchor: string; }
export interface GraficoRadar {
  id: 'calidad' | 'intensidad';
  titulo: string;
  escala: string;
  ejes: EjeRadar[];
  anillos: string[];
  panel: string | null;
  catador: string | null;
}
const RADAR_C = { x: 150, y: 120 };
const RADAR_R = 82;

function puntoRadar(i: number, fraccion: number, radio = RADAR_R): { x: number; y: number } {
  const angulo = (-90 + (i * 360) / ATRIBUTOS_CVA.length) * (Math.PI / 180);
  return {
    x: Math.round((RADAR_C.x + Math.cos(angulo) * radio * fraccion) * 10) / 10,
    y: Math.round((RADAR_C.y + Math.sin(angulo) * radio * fraccion) * 10) / 10
  };
}

/** Polígono SVG; null si no hay ningún valor (no se dibuja la línea). */
function poligonoRadar(valores: (number | null)[], max: number): string | null {
  if (valores.every(v => v === null)) return null;
  return valores
    .map((v, i) => puntoRadar(i, Math.min(1, Math.max(0, (v ?? 0) / max))))
    .map(p => `${p.x},${p.y}`)
    .join(' ');
}

/** Celda CSV (separador `;` para Excel en español). */
const celdaCsv = (v: unknown): string => {
  const texto = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/** Orden y etiquetas de los atributos CVA (claves del CHECK de evaluacion_atributos). */
export const ATRIBUTOS_CVA: readonly { clave: AtributoCva; etiqueta: string }[] = [
  { clave: 'fragancia', etiqueta: 'Fragancia' },
  { clave: 'aroma', etiqueta: 'Aroma' },
  { clave: 'sabor', etiqueta: 'Sabor' },
  { clave: 'sabor_residual', etiqueta: 'Sabor residual' },
  { clave: 'acidez', etiqueta: 'Acidez' },
  { clave: 'dulzor', etiqueta: 'Dulzor' },
  { clave: 'sensacion_boca', etiqueta: 'Sensación en boca' }
];

const ESCALA_HEDONICA_DESC = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
const INTENSIDAD_MAX = 15;
const HEDONICA_MAX = 9;

const textoDe = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Descriptores generales (escáner) + los de cada atributo, sin repetir. */
function descriptoresDe(formulario: Record<string, unknown> | null | undefined): string[] {
  if (!formulario) return [];
  const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const bloques = Object.values((formulario['atributos'] as Record<string, unknown> | undefined) ?? formulario);
  const porAtributo = bloques.flatMap(b => (b && typeof b === 'object' ? lista((b as Record<string, unknown>)['descriptores']) : []));
  return [...new Set([...lista(formulario['descriptores']), ...porAtributo])];
}

export function clasificarPuntaje(puntaje: number): Clasificacion {
  if (puntaje >= 90) return { etiqueta: 'Excepcional', color: '#15803d', fondo: '#f0fdf4' };
  if (puntaje >= 85) return { etiqueta: 'Excelente', color: '#1d4ed8', fondo: '#eff6ff' };
  if (puntaje >= 80) return { etiqueta: 'Muy bueno', color: '#a16207', fondo: '#fefce8' };
  if (puntaje >= 75) return { etiqueta: 'Bueno', color: '#c2410c', fondo: '#fff7ed' };
  return { etiqueta: 'Regular', color: '#6c757d', fondo: '#f8f9fa' };
}

/** Etiqueta verbal de la escala hedónica para un promedio (redondeado al entero). */
export function etiquetaHedonica(promedio: number | null): string {
  if (promedio === null) return 'Sin votos';
  const valor = Math.min(HEDONICA_MAX, Math.max(1, Math.round(promedio)));
  return ETIQUETAS_HEDONICAS[valor] ?? '';
}

const redondear2 = (n: number): number => Math.round(n * 100) / 100;

const ETIQUETA_ATRIBUTO: Readonly<Record<AtributoHoja, string>> = {
  fragancia: 'Fragancia',
  aroma: 'Aroma',
  sabor: 'Sabor',
  sabor_residual: 'Sabor residual',
  acidez: 'Acidez',
  dulzor: 'Dulzor',
  sensacion_boca: 'Sensación en boca'
};

function formatearFecha(valor: string | Date): string {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? ''
    : fecha.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}
const porcentajeDe = (valor: number | null, maximo: number): number =>
  valor === null || maximo <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((valor / maximo) * 1000) / 10));

/* ── Geometría del medidor semicircular (escala 0–100, 50 arriba) ───────── */
const MEDIDOR_CX = 100;
const MEDIDOR_CY = 100;
const MEDIDOR_RADIO = 72;
const AGUJA_RADIO = 60;

/** Convierte un puntaje 0–100 en un punto del semicírculo (0 = izquierda, 100 = derecha). */
export function puntoEnMedidor(valor: number, radio: number): PuntoMedidor {
  const v = Math.min(100, Math.max(0, Number.isFinite(valor) ? valor : 0));
  const angulo = Math.PI * (1 - v / 100);
  return {
    x: Math.round((MEDIDOR_CX + radio * Math.cos(angulo)) * 100) / 100,
    y: Math.round((MEDIDOR_CY - radio * Math.sin(angulo)) * 100) / 100
  };
}

function arco(desde: number, hasta: number, clase: string): ArcoMedidor {
  const a = puntoEnMedidor(desde, MEDIDOR_RADIO);
  const b = puntoEnMedidor(hasta, MEDIDOR_RADIO);
  return { d: `M ${a.x} ${a.y} A ${MEDIDOR_RADIO} ${MEDIDOR_RADIO} 0 0 1 ${b.x} ${b.y}`, clase };
}

function atributosDeFicha(atributos: Partial<Record<string, ValorAtributo>>): AtributoFicha[] {
  return ATRIBUTOS_CVA
    .map(({ clave, etiqueta }) => ({
      clave,
      etiqueta,
      intensidad: atributos[clave]?.intensidad ?? null,
      calidad: atributos[clave]?.calidad ?? null
    }))
    .filter(a => a.intensidad !== null || a.calidad !== null);
}

/**
 * Resultados del panel — EXCLUSIVO del organizador (o administrador).
 * Triple barrera: organizerGuard en la ruta, y en el servidor la RPC
 * get_resumen_panel verifica con EXISTS contra sesiones.organizador_id /
 * usuarios.rol_global y exige el panel cerrado.
 *
 * Una vista por formato CVA:
 *  · Combinado   → medidores, ranking 100 pts y reporte individual.
 *  · Afectivo    → escala hedónica 1–9 y distribución de votos.
 *  · Descriptivo → perfil de intensidades 0–15, sin puntajes de calidad.
 *  · Extrínseco  → ficha técnica del café.
 */
@Component({
  selector: 'app-results',
  templateUrl: './results.page.html',
  styleUrls: ['./results.page.scss'],
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonBackButton, IonButtons,
    IonIcon, IonSpinner, IonCard, IonCardContent, IonGrid, IonRow, IonCol, IonBadge, IonList,
    IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonModal, IonSegment, IonSegmentButton,
    IonSelect, IonSelectOption, IonCheckbox, IonToggle, CupperResultCardComponent, ScaReportTemplateComponent, CommonModule
  ]
})
export class ResultsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly resultsService = inject(ResultsService);
  private readonly impresion = inject(ImpresionService);
  private readonly navCtrl = inject(NavController);
  private readonly toastCtrl = inject(ToastController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly injector = inject(Injector);
  private sesionId = '';

  readonly resultados = signal<SessionResults | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly accesoDenegado = signal(false);
  /** La RPC respondió 22023: la sesión aún no está `completada` (fichas pendientes). */
  readonly panelAbierto = signal(false);
  readonly imprimiendo = signal(false);
  readonly fechaReporte = signal(new Date());

  /** Plantilla oculta con el reporte en HTML plano que se envía a imprimir. */
  private readonly reporteImprimible = viewChild<ElementRef<HTMLElement>>('reporteImprimible');
  private readonly modalExportar = viewChild<IonModal>('modalExportar');

  readonly atributosCva = ATRIBUTOS_CVA;

  readonly tituloFormato = computed(() => {
    const formato = this.resultados()?.formatoCva;
    return formato ? getFormatoById(formato).titulo : '';
  });

  /* ── Formato activo ───────────────────────────────────────────────────── */
  private readonly formato = computed(() => this.resultados()?.formatoCva ?? '');
  readonly esCombinado = computed(() => this.formato() === FormatoCva.COMBINADO.id);
  readonly esAfectivo = computed(() => this.formato() === FormatoCva.AFECTIVO.id);
  readonly esDescriptivo = computed(() => this.formato() === FormatoCva.DESCRIPTIVO.id);
  readonly esExtrinseco = computed(() => this.formato() === FormatoCva.EXTRINSECA.id);
  /** Sesión Personal: se oculta todo lo de panel y solo se muestra la ficha. */
  readonly esPersonal = computed(() => this.resultados()?.esPersonal === true);

  readonly ranking = computed<FilaRanking[]>(() => {
    const muestras = this.resultados()?.muestras ?? [];
    return [...muestras]
      .filter(m => m.evaluacionesRecibidas > 0)
      .sort((a, b) => b.puntajePromedioPanel - a.puntajePromedioPanel)
      .map((m, indice) => ({ ...m, posicion: indice + 1, clasificacion: clasificarPuntaje(m.puntajePromedioPanel) }));
  });

  readonly muestrasSinFichas = computed(
    () => this.resultados()?.muestras.filter(m => m.evaluacionesRecibidas === 0) ?? []
  );

  readonly promedioPanel = computed(() => {
    const filas = this.ranking();
    if (filas.length === 0) return 0;
    return Math.round((filas.reduce((total, f) => total + f.puntajePromedioPanel, 0) / filas.length) * 100) / 100;
  });

  readonly clasificacionPanel = computed(() => clasificarPuntaje(this.promedioPanel()));

  readonly catadoresCompletos = computed(
    () => this.resultados()?.catadores.filter(c => c.estado === 'enviado').length ?? 0
  );

  readonly porcentajeCompletado = computed(() => {
    const total = this.resultados()?.catadores.length ?? 0;
    return total === 0 ? 0 : Math.round((this.catadoresCompletos() / total) * 100);
  });

  readonly hayRecorte = computed(() => this.ranking().some(f => f.recortado));

  /** Números de muestra de la sesión, ordenados. */
  readonly numerosMuestra = computed(() =>
    [...new Set((this.resultados()?.muestras ?? []).map(m => m.numeroMuestra))].sort((a, b) => a - b)
  );

  /**
   * Fichas recibidas por muestra contadas desde los catadores. No se usa
   * `evaluacionesRecibidas` porque cuenta `puntaje_final`, que es NULL en
   * el formato Descriptivo.
   */
  readonly fichasPorMuestra = computed(() => {
    const conteo = new Map<number, number>();
    for (const catador of this.resultados()?.catadores ?? []) {
      for (const ficha of catador.puntajesPorMuestra) {
        conteo.set(ficha.numeroMuestra, (conteo.get(ficha.numeroMuestra) ?? 0) + 1);
      }
    }
    return conteo;
  });

  /* ── Vista Combinado ──────────────────────────────────────────────────── */

  /** Arcos de color del medidor: rojo / ámbar / verde claro / verde. */
  readonly arcosMedidor: readonly ArcoMedidor[] = [
    arco(0, 30, 'rc-gauge__arc--bajo'),
    arco(30, 50, 'rc-gauge__arc--medio'),
    arco(50, 75, 'rc-gauge__arc--alto'),
    arco(75, 100, 'rc-gauge__arc--top')
  ];
  readonly centroMedidor: PuntoMedidor = { x: MEDIDOR_CX, y: MEDIDOR_CY };

  /** Muestra elegida en el ranking para el segundo medidor (null = la #1). */
  private readonly muestraMedidorNumero = signal<number | null>(null);

  readonly muestraEnMedidor = computed<FilaRanking | null>(() => {
    const filas = this.ranking();
    const elegida = this.muestraMedidorNumero();
    return filas.find(f => f.numeroMuestra === elegida) ?? filas[0] ?? null;
  });

  readonly agujaPanel = computed(() => puntoEnMedidor(this.promedioPanel(), AGUJA_RADIO));
  readonly agujaMuestra = computed(() => puntoEnMedidor(this.muestraEnMedidor()?.puntajePromedioPanel ?? 0, AGUJA_RADIO));

  /** Catador mostrado en "Reporte de sesión individual" (null = primero con fichas enviadas). */
  private readonly catadorReporteId = signal<string | null>(null);

  readonly catadorReporte = computed<CupperResultSummary | null>(() => {
    const catadores = this.resultados()?.catadores ?? [];
    const elegido = this.catadorReporteId();
    return catadores.find(c => c.cupperId === elegido)
      ?? catadores.find(c => c.estado === 'enviado')
      ?? catadores[0]
      ?? null;
  });

  /** Fichas del catador seleccionado, ordenadas por número de muestra. */
  readonly fichasReporte = computed<FichaReporte[]>(() =>
    // En panel, sin puntaje = ficha incompleta. En Sesión Personal la ficha
    // escaneada puede no tener puntaje (calidades sin leer) y aun así se muestra.
    this.fichasDe(this.catadorReporte()).filter(f => this.esPersonal() || !f.sinPuntaje)
  );

  /* ── Vista Afectivo ───────────────────────────────────────────────────── */

  /** Muestra elegida para el detalle de Afectivo / Descriptivo (null = la primera). */
  private readonly muestraDetalleNumero = signal<number | null>(null);

  readonly resultadosHedonicos = computed<FilaHedonica[]>(() => {
    const r = this.resultados();
    if (!r) return [];
    const filas = this.numerosMuestra().map(numeroMuestra => {
      const votos = r.votosHedonicos.filter(v => v.numeroMuestra === numeroMuestra);
      const totalVotos = votos.reduce((t, v) => t + v.votos, 0);
      const promedio = totalVotos === 0 ? null : redondear2(votos.reduce((t, v) => t + v.valor * v.votos, 0) / totalVotos);
      const distribucion = ESCALA_HEDONICA_DESC.map(valor => {
        const n = votos.find(v => v.valor === valor)?.votos ?? 0;
        return { valor, votos: n, porcentaje: porcentajeDe(n, totalVotos), etiqueta: ETIQUETAS_HEDONICAS[valor] ?? '' };
      });
      const atributos = ATRIBUTOS_CVA.map(({ clave, etiqueta }) => {
        const valor = r.atributosPorMuestra.find(a => a.numeroMuestra === numeroMuestra && a.atributo === clave)?.calidadPromedio ?? null;
        return { clave, etiqueta, valor, porcentaje: porcentajeDe(valor, HEDONICA_MAX) };
      });
      return { numeroMuestra, posicion: 0, totalVotos, promedio, etiqueta: etiquetaHedonica(promedio), distribucion, atributos };
    });
    return filas
      .sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1) || a.numeroMuestra - b.numeroMuestra)
      .map((f, i) => ({ ...f, posicion: f.promedio === null ? 0 : i + 1 }));
  });

  readonly hedonicoSeleccionado = computed<FilaHedonica | null>(() => {
    const filas = this.resultadosHedonicos();
    const elegida = this.muestraDetalleNumero();
    return filas.find(f => f.numeroMuestra === elegida) ?? filas[0] ?? null;
  });

  /* ── Vista Descriptivo ────────────────────────────────────────────────── */

  readonly perfilesDescriptivos = computed<PerfilDescriptivo[]>(() => {
    const r = this.resultados();
    if (!r) return [];
    return this.numerosMuestra().map(numeroMuestra => ({
      numeroMuestra,
      fichas: this.fichasPorMuestra().get(numeroMuestra) ?? 0,
      atributos: ATRIBUTOS_CVA.map(({ clave, etiqueta }) => {
        const fila = r.atributosPorMuestra.find(a => a.numeroMuestra === numeroMuestra && a.atributo === clave);
        const valor = fila?.intensidadPromedio ?? null;
        return { clave, etiqueta, valor, porcentaje: porcentajeDe(valor, INTENSIDAD_MAX), respuestas: fila?.respuestas ?? 0 };
      })
    }));
  });

  readonly perfilSeleccionado = computed<PerfilDescriptivo | null>(() => {
    const perfiles = this.perfilesDescriptivos();
    const elegida = this.muestraDetalleNumero();
    return perfiles.find(p => p.numeroMuestra === elegida) ?? perfiles[0] ?? null;
  });

  /* ── Vista Extrínseco ─────────────────────────────────────────────────── */
  readonly fichasTecnicas = computed(() => this.resultados()?.fichasTecnicas ?? []);

  /* ── Gráficas de perfil (radar) ───────────────────────────────────────── */
  readonly mostrarGraficas = signal(false);
  private readonly muestraRadarNumero = signal<number | null>(null);
  readonly muestraRadar = computed(() =>
    this.muestraRadarNumero() ?? this.muestraEnMedidor()?.numeroMuestra ?? this.numerosMuestra()[0] ?? null
  );
  /** Catadores con ficha (los mismos de la tarjeta "Reporte de sesión individual"). */
  readonly catadoresConFichas = computed(() => this.resultados()?.catadores.filter(c => c.puntajesPorMuestra.length > 0) ?? []);

  readonly graficasRadar = computed<GraficoRadar[]>(() => {
    const r = this.resultados();
    const muestra = this.muestraRadar();
    if (!r || muestra === null) return [];
    const tipos: GraficoRadar['id'][] = this.esAfectivo() ? ['calidad']
      : this.esDescriptivo() ? ['intensidad']
      : this.esCombinado() ? ['calidad', 'intensidad'] : [];

    const promedios = r.atributosPorMuestra.filter(a => a.numeroMuestra === muestra);
    const ficha = this.catadorReporte()?.puntajesPorMuestra.find(p => p.numeroMuestra === muestra);

    return tipos.map(id => {
      const max = id === 'calidad' ? 9 : 15;
      const ejes = ATRIBUTOS_CVA.map(({ etiqueta }, i) => {
        const fin = puntoRadar(i, 1);
        const rotulo = puntoRadar(i, 1, RADAR_R + 14);
        const anchor = Math.abs(rotulo.x - RADAR_C.x) < 4 ? 'middle' : rotulo.x > RADAR_C.x ? 'start' : 'end';
        return { ...fin, lx: rotulo.x, ly: rotulo.y + 3, etiqueta, anchor };
      });
      const anillos = [0.25, 0.5, 0.75, 1].map(f =>
        ATRIBUTOS_CVA.map((_, i) => puntoRadar(i, f)).map(p => `${p.x},${p.y}`).join(' ')
      );
      const valorPanel = (clave: AtributoCva) => {
        const p = promedios.find(a => a.atributo === clave);
        return (id === 'calidad' ? p?.calidadPromedio : p?.intensidadPromedio) ?? null;
      };
      const valorCatador = (clave: AtributoCva) => ficha?.atributos[clave]?.[id] ?? null;
      return {
        id,
        titulo: id === 'calidad' ? 'Perfil de calidad (afectivo)' : 'Perfil de intensidad (descriptivo)',
        escala: id === 'calidad' ? 'Escala 1 – 9' : 'Escala 0 – 15',
        ejes,
        anillos,
        panel: poligonoRadar(ATRIBUTOS_CVA.map(a => valorPanel(a.clave)), max),
        catador: poligonoRadar(ATRIBUTOS_CVA.map(a => valorCatador(a.clave)), max)
      };
    });
  });

  alternarGraficas(valor: boolean): void {
    this.mostrarGraficas.set(valor);
  }

  seleccionarMuestraRadar(valor: unknown): void {
    const n = Number(valor);
    if (Number.isFinite(n)) this.muestraRadarNumero.set(n);
  }

  seleccionarCatadorRadar(valor: unknown): void {
    if (typeof valor === 'string') this.catadorReporteId.set(valor);
  }

  /* ── Modal de exportación (Combinado) ─────────────────────────────────── */
  readonly modalExportarAbierto = signal(false);
  readonly modoExportacion = signal<ModoExportacion>('panel');
  readonly muestraExportar = signal<number | null>(null);
  readonly catadorExportarId = signal<string | null>(null);

  /** Solo catadores con fichas enviadas pueden exportarse individualmente. */
  readonly catadoresExportables = computed(
    () => this.resultados()?.catadores.filter(c => c.muestrasEvaluadas > 0) ?? []
  );

  /* ── Hoja SCA imprimible (Combinado / Descriptivo) ────────────────────── */

  /** Formatos que se exportan con la hoja SCA (los demás usan su reporte propio). */
  readonly formatoHoja = computed<FormatoHoja | null>(() =>
    this.esCombinado() ? 'combinado' : this.esDescriptivo() ? 'descriptivo' : this.esAfectivo() ? 'afectivo' : null
  );

  /** Los 4 formatos se imprimen con la hoja SCA (ScaReportTemplateComponent). */
  readonly formatoReporte = computed<FormatoReporteSca | null>(() =>
    this.esExtrinseco() ? 'extrinseca' : this.formatoHoja()
  );
  readonly fechaTextoReporte = computed(() => formatearFecha(this.fechaReporte()));

  readonly escala9 = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  readonly descriptoresSca = DESCRIPTORES_SCA;
  readonly gustosSca = GUSTOS_SCA;
  readonly bocaSca = BOCA_SCA;
  readonly defectosSca = DEFECTOS_SCA;
  readonly circuloMarcado = circuloMarcado;
  readonly etiquetaCalidad = etiquetaCalidad;
  readonly LEYENDA_HEDONICA = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ n, etiqueta: ETIQUETAS_HEDONICAS[n] ?? '' }));

  /** Catadores incluidos en el consolidado del panel (el organizador desmarca a los descalibrados). */
  readonly catadoresPanelIds = signal<ReadonlySet<string>>(new Set());

  /** Muestra elegida en el modal (por defecto, la del medidor o la primera). */
  readonly muestraHoja = computed<number | null>(() =>
    this.muestraExportar() ?? this.muestraEnMedidor()?.numeroMuestra ?? this.numerosMuestra()[0] ?? null
  );

  readonly catadorExportar = computed<CupperResultSummary | null>(() =>
    this.resultados()?.catadores.find(c => c.cupperId === this.catadorExportarId()) ?? null
  );

  /** Opciones del modal en modo Panel: quién tiene ficha de la muestra y su calibración. */
  readonly opcionesPanel = computed(() => {
    const muestra = this.muestraHoja();
    const seleccion = this.catadoresPanelIds();
    return this.catadoresExportables().map(c => ({
      id: c.cupperId,
      nombre: c.nombre,
      tieneFicha: c.puntajesPorMuestra.some(p => p.numeroMuestra === muestra),
      seleccionado: seleccion.has(c.cupperId),
      desviacion: c.desviacionRespectoPanel
    }));
  });

  readonly puedeConfirmarExportar = computed(() => {
    if (this.imprimiendo() || this.muestraHoja() === null) return false;
    if (!this.formatoHoja()) return true;
    if (this.modoExportacion() === 'catador') {
      return this.catadorExportar()?.puntajesPorMuestra.some(p => p.numeroMuestra === this.muestraHoja()) ?? false;
    }
    return this.opcionesPanel().some(o => o.seleccionado && o.tieneFicha);
  });

  /**
   * Datos de la hoja SCA según el modal:
   *  · Por catador → su ficha tal cual (sliders, casillas, círculos, notas).
   *  · Panel → solo catadores marcados: promedio de intensidades, mayoría
   *    (> 50 %) en casillas y entero más cercano en los círculos 1–9.
   */
  readonly hojaSca = computed<HojaSca | null>(() => {
    const r = this.resultados();
    const formato = this.formatoHoja();
    const numero = this.muestraHoja();
    if (!r || !formato || numero === null) return null;

    const muestra = r.muestras.find(m => m.numeroMuestra === numero);
    const base = {
      formato,
      titulo: formato === 'combinado' ? 'Formato Combinado' : formato === 'afectivo' ? 'Formato Afectivo' : 'Formato Descriptivo',
      objetivo: r.nombreSesion,
      numeroMuestra: numero,
      nivelTueste: muestra?.nivelTueste ?? null
    };

    if (this.modoExportacion() === 'catador') {
      const catador = this.catadorExportar();
      const ficha = catador?.puntajesPorMuestra.find(p => p.numeroMuestra === numero);
      if (!catador || !ficha) return null;
      return {
        ...base,
        esPanel: false,
        nombre: catador.nombre,
        fecha: formatearFecha(catador.submittedAt ?? this.fechaReporte()),
        ficha: leerFichaSca(ficha),
        resumenPanel: null
      };
    }

    const seleccion = this.catadoresPanelIds();
    const conFicha = r.catadores
      .map(c => ({ catador: c, ficha: c.puntajesPorMuestra.find(p => p.numeroMuestra === numero) }))
      .filter((x): x is { catador: CupperResultSummary; ficha: NonNullable<typeof x.ficha> } => !!x.ficha);
    const incluidos = conFicha.filter(x => seleccion.has(x.catador.cupperId));
    const excluidos = conFicha.filter(x => !seleccion.has(x.catador.cupperId));
    if (incluidos.length === 0) return null;

    const resumen = [
      `Consolidado de ${incluidos.length} ficha(s): ${incluidos.map(x => x.catador.nombre).join(', ')}.`,
      excluidos.length ? `Excluidos por el organizador: ${excluidos.map(x => x.catador.nombre).join(', ')}.` : '',
    ].filter(Boolean).join(' ');

    const puntajes = incluidos.map(x => x.ficha.puntaje).filter(p => p > 0);
    const puntaje = formato !== 'descriptivo' ? puntajePanel(puntajes) : null;
    return {
      ...base,
      esPanel: true,
      nombre: 'Consolidado del Panel',
      fecha: formatearFecha(this.fechaReporte()),
      ficha: consolidarFichas(incluidos.map(x => leerFichaSca(x.ficha)), resumen, incluidos.map(x => x.catador.nombre)),
      resumenPanel: {
        puntaje,
        clasificacion: puntaje === null ? '' : clasificarPuntaje(puntaje).etiqueta,
        fichas: `${incluidos.length} / ${conFicha.length}`,
        minMax: puntajes.length ? `${Math.min(...puntajes).toFixed(2)} – ${Math.max(...puntajes).toFixed(2)}` : '—',
        recortado: puntajes.length >= 5
      }
    };
  });

  /** Nombre del documento: el navegador lo propone como nombre del PDF. */
  readonly tituloReporte = computed(() => {
    const r = this.resultados();
    if (!r) return 'Reporte PacamaraQs';
    const partes = [this.esExtrinseco() ? 'Ficha técnica' : 'Reporte SCA', r.nombreSesion, this.tituloFormato()];
    if (this.formatoHoja()) {
      const muestra = this.muestraHoja();
      if (muestra) partes.push(`Muestra ${muestra}`);
      if (this.modoExportacion() === 'catador') {
        if (this.catadorExportar()) partes.push(this.catadorExportar()!.nombre);
      } else {
        partes.push('Panel');
      }
    }
    return partes.filter(Boolean).join(' - ');
  });

  constructor() {
    addIcons({
      checkmarkCircleOutline, closeOutline, documentTextOutline, downloadOutline, gridOutline, hourglassOutline, lockClosedOutline,
      medalOutline, ribbonOutline, trophyOutline
    });
  }

  async ngOnInit(): Promise<void> {
    const sesionId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    this.sesionId = sesionId;
    if (!sesionId) {
      this.error.set('No se encontró el ID de la sesión.');
      this.cargando.set(false);
      return;
    }

    try {
      const resultados = await this.resultsService.obtenerResultadosSesion(sesionId);
      this.resultados.set(resultados);
      if (!resultados) this.error.set('No se encontraron resultados para esta sesión.');
    } catch (error) {
      const codigo = codigoDeError(error);
      if (codigo === '42501') this.accesoDenegado.set(true);
      if (codigo === '22023') this.panelAbierto.set(true);
      this.error.set(mensajeDeError(error, 'No se pudieron cargar los resultados.'));
    } finally {
      this.cargando.set(false);
    }
  }

  seleccionarMuestraMedidor(numeroMuestra: number): void {
    this.muestraMedidorNumero.set(numeroMuestra);
  }

  seleccionarCatadorReporte(cupperId: string): void {
    this.catadorReporteId.set(cupperId);
  }

  seleccionarMuestraDetalle(valor: unknown): void {
    const n = Number(valor);
    if (Number.isFinite(n)) this.muestraDetalleNumero.set(n);
  }

  /** Abre el modal; opcionalmente pre-seleccionado desde una ficha individual. */
  abrirExportar(opciones?: { numeroMuestra: number; cupperId: string }): void {
    // Sesión Personal: una sola ficha → PDF directo, sin elegir catador/muestra.
    if (this.esPersonal()) {
      const catador = this.catadorReporte();
      this.modoExportacion.set('catador');
      this.catadorExportarId.set(opciones?.cupperId ?? catador?.cupperId ?? null);
      this.muestraExportar.set(opciones?.numeroMuestra ?? this.numerosMuestra()[0] ?? 1);
      void this.exportarPDF();
      return;
    }
    // Primera apertura: todos los catadores con fichas entran al consolidado.
    if (this.catadoresPanelIds().size === 0) {
      this.catadoresPanelIds.set(new Set(this.catadoresExportables().map(c => c.cupperId)));
    }
    if (opciones) {
      this.muestraExportar.set(opciones.numeroMuestra);
      this.catadorExportarId.set(opciones.cupperId);
      this.modoExportacion.set('catador');
    } else {
      this.muestraExportar.set(this.muestraHoja());
      this.catadorExportarId.set(this.catadorExportarId() ?? this.catadorReporte()?.cupperId ?? null);
    }
    this.modalExportarAbierto.set(true);
  }

  cerrarExportar(): void {
    this.modalExportarAbierto.set(false);
  }

  cambiarModoExportacion(valor: unknown): void {
    if (valor === 'panel' || valor === 'catador') this.modoExportacion.set(valor);
  }

  cambiarMuestraExportar(valor: unknown): void {
    const n = Number(valor);
    this.muestraExportar.set(Number.isFinite(n) ? n : null);
  }

  cambiarCatadorExportar(valor: unknown): void {
    this.catadorExportarId.set(typeof valor === 'string' ? valor : null);
  }

  /** Texto de la columna afectiva: valor hedónico de cada atributo de la fila. */
  etiquetasAfectivas(hoja: HojaSca, atributos: readonly AtributoHoja[]): string {
    return atributos
      .map(a => {
        const valor = hoja.ficha.calidad[a];
        if (valor === null) return '';
        const prefijo = hoja.esPanel && !Number.isInteger(valor) ? `prom. ${valor.toFixed(2)} → ` : '';
        return `${ETIQUETA_ATRIBUTO[a]}: ${prefijo}${etiquetaCalidad(valor)}`;
      })
      .filter(Boolean)
      .join(' · ');
  }

  /** Cajas de tazas (0–5) que se marcan: entero más cercano. */
  circuloMarcadoTazas(valor: number): number {
    return Math.min(5, Math.max(0, Math.round(valor)));
  }

  toggleCatadorPanel(cupperId: string, incluir: boolean): void {
    const siguiente = new Set(this.catadoresPanelIds());
    if (incluir) siguiente.add(cupperId);
    else siguiente.delete(cupperId);
    this.catadoresPanelIds.set(siguiente);
  }

  async confirmarExportar(): Promise<void> {
    if (!this.puedeConfirmarExportar()) return;
    // Cerrar el modal y esperar su animación ANTES de imprimir: si el diálogo
    // de impresión se abre con el modal en transición, el backdrop queda
    // bloqueando la pantalla al volver.
    await this.modalExportar()?.dismiss().catch(() => undefined);
    this.cerrarExportar();
    await this.exportarPDF();
  }

  /** Botón "Exportar": elige PDF o Excel (.csv). */
  async abrirMenuExportar(): Promise<void> {
    if (!this.resultados() || this.imprimiendo()) return;
    const menu = await this.actionSheetCtrl.create({
      header: '¿En qué formato deseas exportar?',
      buttons: [
        { text: 'PDF', icon: 'document-text-outline', role: 'pdf' },
        { text: 'Excel (.csv)', icon: 'grid-outline', role: 'csv' },
        { text: 'Cancelar', role: 'cancel', icon: 'close-outline' }
      ]
    });
    await menu.present();
    // Se actúa cuando el menú YA se cerró: abrir el modal o el diálogo de
    // impresión con el action sheet aún animándose dejaba un backdrop encima.
    const { role } = await menu.onDidDismiss();
    if (role === 'pdf') this.exportarPdfSegunFormato();
    else if (role === 'csv') this.exportarCsv();
  }

  /** Combinado/Descriptivo abren el modal de la hoja SCA; los demás imprimen directo. */
  exportarPdfSegunFormato(): void {
    if (this.formatoHoja()) this.abrirExportar();
    else void this.exportarPDF();
  }

  /**
   * CSV nativo (sin librerías): una fila por catador y muestra con el promedio
   * del panel, el puntaje del catador y sus atributos. BOM UTF-8 + `;` para
   * que Excel en español abra tildes y columnas correctamente.
   */
  exportarCsv(): void {
    const r = this.resultados();
    if (!r) return;
    const filas: unknown[][] = [];
    if (this.esExtrinseco()) {
      filas.push(['Muestra', 'Sección', 'Campo', 'Valor']);
      for (const f of r.fichasTecnicas) {
        for (const s of f.secciones) for (const c of s.campos) filas.push([f.numeroMuestra, s.titulo, c.etiqueta, c.valor]);
        filas.push([f.numeroMuestra, 'Certificaciones', '', f.certificaciones.join(', ')]);
        if (f.notas) filas.push([f.numeroMuestra, 'Notas', '', f.notas]);
      }
    } else {
      filas.push([
        'Muestra', 'Nivel de tueste', 'Promedio panel', 'Catador', 'Rol', 'Puntaje catador', 'Impresión global',
        'Tazas no uniformes', 'Tazas defectuosas',
        ...ATRIBUTOS_CVA.flatMap(a => [`${a.etiqueta} intensidad`, `${a.etiqueta} calidad`])
      ]);
      for (const m of [...r.muestras].sort((a, b) => a.numeroMuestra - b.numeroMuestra)) {
        const panel = m.puntajePromedioPanel > 0 ? m.puntajePromedioPanel : null;
        const fichas = r.catadores.flatMap(c =>
          c.puntajesPorMuestra.filter(p => p.numeroMuestra === m.numeroMuestra).map(p => ({ c, p }))
        );
        if (fichas.length === 0) filas.push([m.numeroMuestra, m.nivelTueste, panel, 'Sin fichas']);
        for (const { c, p } of fichas) {
          filas.push([
            m.numeroMuestra, m.nivelTueste, panel, c.nombre, c.esOrganizador ? 'Organizador' : 'Catador',
            p.puntaje > 0 ? p.puntaje : null, p.impresionGlobal, p.tazasNoUniformes, p.tazasDefectuosas,
            ...ATRIBUTOS_CVA.flatMap(a => [p.atributos[a.clave]?.intensidad ?? null, p.atributos[a.clave]?.calidad ?? null])
          ]);
        }
      }
    }
    const csv = '\uFEFF' + filas.map(f => f.map(celdaCsv).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${this.tituloReporte().replace(/[\\/:*?"<>|]+/g, '-')}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Imprime el reporte del formato activo. El usuario elige "Guardar como
   * PDF" en el diálogo del navegador. Se espera un render para que la
   * plantilla oculta refleje la muestra / catador elegidos en el modal.
   */
  async exportarPDF(): Promise<void> {
    if (!this.resultados() || this.imprimiendo()) return;
    this.imprimiendo.set(true);
    this.fechaReporte.set(new Date());
    try {
      await this.esperarRender();
      const contenedor = this.reporteImprimible()?.nativeElement;
      if (!contenedor) throw new Error('No se pudo preparar el reporte para imprimir.');
      await this.impresion.imprimir(this.tituloReporte(), contenedor.innerHTML);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: mensajeDeError(error, 'No se pudo generar el PDF.'),
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.imprimiendo.set(false);
    }
  }

  /** Con fichas pendientes, el organizador finaliza el panel desde el monitoreo. */
  irAMonitoreo(): void {
    if (this.sesionId) void this.navCtrl.navigateForward(`/session/${this.sesionId}/organizer-dashboard`);
  }

  volverAlPanel(): void {
    void this.navCtrl.navigateRoot('/dashboard');
  }

  private fichasDe(catador: CupperResultSummary | null): FichaReporte[] {
    return [...(catador?.puntajesPorMuestra ?? [])]
      .sort((a, b) => a.numeroMuestra - b.numeroMuestra)
      .map(p => ({
        numeroMuestra: p.numeroMuestra,
        puntaje: p.puntaje,
        sinPuntaje: !(p.puntaje > 0),
        notas: textoDe(p.formulario?.['notas'] ?? p.formulario?.['notes']),
        descriptores: descriptoresDe(p.formulario),
        tazasNoUniformes: p.tazasNoUniformes,
        tazasDefectuosas: p.tazasDefectuosas,
        impresionGlobal: p.impresionGlobal,
        atributos: atributosDeFicha(p.atributos),
        clasificacion: clasificarPuntaje(p.puntaje)
      }));
  }

  private esperarRender(): Promise<void> {
    return new Promise(resolve => afterNextRender(() => resolve(), { injector: this.injector }));
  }
}
