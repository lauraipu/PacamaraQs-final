import { CupperResultSummary } from '../models/session-results.model';
import { ETIQUETAS_HEDONICAS, RUEDA_SABORES } from './cva';

/**
 * Hoja de evaluación con la estructura de los formatos Combinado y
 * Descriptivo de la SCA (Versión 2, junio 2024), llenada con los datos de
 * PacamaraQs. Lógica pura (sin Angular) para poder probarla.
 *
 * Fuentes de datos de cada ficha:
 *  · intensidad / calidad → evaluacion_atributos (respaldo: JSON del formulario).
 *  · descriptores, textura, defectos y notas → JSON del formulario
 *    (evaluaciones.notas): las tablas evaluacion_descriptores / _defectos no
 *    se llenan desde la app.
 */

export type FormatoHoja = 'combinado' | 'descriptivo';
export type AtributoHoja =
  | 'fragancia' | 'aroma' | 'sabor' | 'sabor_residual' | 'acidez' | 'dulzor' | 'sensacion_boca';

export const ATRIBUTOS_HOJA: readonly AtributoHoja[] = [
  'fragancia', 'aroma', 'sabor', 'sabor_residual', 'acidez', 'dulzor', 'sensacion_boca'
];

/** Clave del atributo en el JSON de los formularios (camelCase). */
const CLAVE_FORMULARIO: Readonly<Record<AtributoHoja, string>> = {
  fragancia: 'fragancia',
  aroma: 'aroma',
  sabor: 'sabor',
  sabor_residual: 'saborResidual',
  acidez: 'acidez',
  dulzor: 'dulzor',
  sensacion_boca: 'sensacionEnBoca'
};

export interface CasillaSca {
  clave: string;
  etiqueta: string;
  /** Categoría (negrita en la hoja) o subdescriptor. */
  principal: boolean;
}

/** Casillas de descriptores de la hoja SCA, fila por fila. */
export const DESCRIPTORES_SCA: readonly (readonly CasillaSca[])[] = [
  [{ clave: 'floral', etiqueta: 'Floral', principal: true }],
  [
    { clave: 'afrutado', etiqueta: 'Afrutado', principal: true },
    { clave: 'afrutado.bayas', etiqueta: 'Bayas', principal: false },
    { clave: 'afrutado.deshidratadas', etiqueta: 'Frutas deshidratadas', principal: false },
    { clave: 'afrutado.citricos', etiqueta: 'Cítricos', principal: false }
  ],
  [
    { clave: 'acido_fermentado', etiqueta: 'Ácido/Fermentado', principal: true },
    { clave: 'acido_fermentado.acido', etiqueta: 'Ácido', principal: false },
    { clave: 'acido_fermentado.fermentado', etiqueta: 'Fermentado', principal: false }
  ],
  [{ clave: 'verde', etiqueta: 'Verde/Vegetal', principal: true }],
  [
    { clave: 'otra', etiqueta: 'Otra', principal: true },
    { clave: 'otra.quimico', etiqueta: 'Químico', principal: false },
    { clave: 'otra.humedad', etiqueta: 'Humedad/Tierra', principal: false },
    { clave: 'otra.madera', etiqueta: 'Madera', principal: false }
  ],
  [
    { clave: 'tostado', etiqueta: 'Tostado', principal: true },
    { clave: 'tostado.cereal', etiqueta: 'Cereal', principal: false },
    { clave: 'tostado.quemado', etiqueta: 'Quemado', principal: false },
    { clave: 'tostado.tabaco', etiqueta: 'Tabaco', principal: false }
  ],
  [
    { clave: 'nueces_cacao', etiqueta: 'Nueces/Cacao', principal: true },
    { clave: 'nueces_cacao.nueces', etiqueta: 'Nueces', principal: false },
    { clave: 'nueces_cacao.cacao', etiqueta: 'Cacao', principal: false }
  ],
  [{ clave: 'especias', etiqueta: 'Especias', principal: true }],
  [
    { clave: 'dulce', etiqueta: 'Dulce', principal: true },
    { clave: 'dulce.vainilla', etiqueta: 'Vainilla', principal: false },
    { clave: 'dulce.azucar_morena', etiqueta: 'Azúcar morena', principal: false }
  ]
];

export const GUSTOS_SCA: readonly CasillaSca[] = [
  { clave: 'salado', etiqueta: 'Salado', principal: true },
  { clave: 'acido', etiqueta: 'Ácido', principal: true },
  { clave: 'dulce', etiqueta: 'Dulce', principal: true },
  { clave: 'amargo', etiqueta: 'Amargo', principal: true },
  { clave: 'umami', etiqueta: 'Umami', principal: true }
];

export const BOCA_SCA: readonly (CasillaSca & { detalle: string })[] = [
  { clave: 'aspero', etiqueta: 'Áspero', detalle: '(Arenoso, Rugoso, Rasposo)', principal: true },
  { clave: 'aceitoso', etiqueta: 'Aceitoso', detalle: '', principal: true },
  { clave: 'suave', etiqueta: 'Suave', detalle: '(Aterciopelado, Sedoso, Almibarado)', principal: true },
  { clave: 'astringente', etiqueta: 'Deja seca la boca', detalle: '(astringente)', principal: true },
  { clave: 'metalico', etiqueta: 'Metálico', detalle: '', principal: true }
];

export const DEFECTOS_SCA: readonly CasillaSca[] = [
  { clave: 'mohoso', etiqueta: 'Mohoso', principal: true },
  { clave: 'fenolico', etiqueta: 'Fenólico', principal: true },
  { clave: 'papa', etiqueta: 'Papa', principal: true }
];

export const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Categoría de la rueda de la app → casilla principal de la hoja SCA. */
const CATEGORIA_APP_A_SCA: Readonly<Record<string, string>> = {
  [normalizar('Floral')]: 'floral',
  [normalizar('Afrutado')]: 'afrutado',
  [normalizar('Ácido / Fermentado')]: 'acido_fermentado',
  [normalizar('Verde / Vegetal')]: 'verde',
  [normalizar('Otro')]: 'otra',
  [normalizar('Tostado')]: 'tostado',
  [normalizar('Nueces / Cacao')]: 'nueces_cacao',
  [normalizar('Especias')]: 'especias',
  [normalizar('Dulce')]: 'dulce'
};

/**
 * Subdescriptor de la app → subcasilla SCA. Las equivalencias siguen la
 * rueda de sabores SCA/WCR (p. ej. miel y caramelo pertenecen a "azúcar
 * morena"; tinta y caucho a "químico"). Lo que no tiene casilla propia marca
 * solo la categoría y se lista por nombre en Notas.
 */
const SUB_APP_A_SCA: Readonly<Record<string, string>> = {
  [normalizar('Bayas')]: 'afrutado.bayas',
  [normalizar('Frutas deshidratadas')]: 'afrutado.deshidratadas',
  [normalizar('Cítricos')]: 'afrutado.citricos',
  [normalizar('Ácido acético')]: 'acido_fermentado.acido',
  [normalizar('Agrio')]: 'acido_fermentado.acido',
  [normalizar('Fermentado')]: 'acido_fermentado.fermentado',
  [normalizar('Madera')]: 'otra.madera',
  [normalizar('Tinta')]: 'otra.quimico',
  [normalizar('Caucho')]: 'otra.quimico',
  [normalizar('Cereal')]: 'tostado.cereal',
  [normalizar('Quemado')]: 'tostado.quemado',
  [normalizar('Tabaco')]: 'tostado.tabaco',
  [normalizar('Pipa')]: 'tostado.tabaco',
  [normalizar('Nueces')]: 'nueces_cacao.nueces',
  [normalizar('Almendra')]: 'nueces_cacao.nueces',
  [normalizar('Cacao')]: 'nueces_cacao.cacao',
  [normalizar('Chocolate')]: 'nueces_cacao.cacao',
  [normalizar('Vainilla')]: 'dulce.vainilla',
  [normalizar('Azúcar morena')]: 'dulce.azucar_morena',
  [normalizar('Miel')]: 'dulce.azucar_morena',
  [normalizar('Caramelo')]: 'dulce.azucar_morena'
};

/** Subdescriptor de la app → categoría de la app, derivado de RUEDA_SABORES. */
const CATEGORIA_DE_SUB: ReadonlyMap<string, string> = new Map(
  Object.entries(RUEDA_SABORES).flatMap(([categoria, { subdescriptores }]) =>
    subdescriptores.map(sub => [normalizar(sub), normalizar(categoria)] as const)
  )
);

/** Convierte los descriptores elegidos en la app a casillas SCA. */
export function casillasDeDescriptores(descriptores: readonly string[]): Set<string> {
  const casillas = new Set<string>();
  for (const descriptor of descriptores) {
    const n = normalizar(descriptor);
    const categoriaDirecta = CATEGORIA_APP_A_SCA[n];
    if (categoriaDirecta) {
      casillas.add(categoriaDirecta);
      continue;
    }
    const sub = SUB_APP_A_SCA[n];
    if (sub) {
      casillas.add(sub);
      casillas.add(sub.split('.')[0]);
      continue;
    }
    const categoria = CATEGORIA_DE_SUB.get(n);
    const clave = categoria ? CATEGORIA_APP_A_SCA[categoria] : undefined;
    if (clave) casillas.add(clave);
  }
  return casillas;
}

/** Textura en boca (Combinado: `mouthfeel`, Descriptivo: `sensacionEnBoca.textura`). */
export function casillasDeBoca(valores: readonly string[]): Set<string> {
  const casillas = new Set<string>();
  for (const valor of valores) {
    const n = normalizar(valor);
    if (n.startsWith('aspero')) casillas.add('aspero');
    else if (n.startsWith('aceitoso')) casillas.add('aceitoso');
    else if (n.startsWith('suave')) casillas.add('suave');
    else if (n.startsWith('astringente') || n.includes('seca la boca')) casillas.add('astringente');
    else if (n.startsWith('metalico')) casillas.add('metalico');
  }
  return casillas;
}

export function casillasDeDefectos(valores: readonly string[]): Set<string> {
  const casillas = new Set<string>();
  for (const valor of valores) {
    const n = normalizar(valor);
    if (n.includes('mohoso')) casillas.add('mohoso');
    if (n.includes('fenolico')) casillas.add('fenolico');
    if (n.startsWith('papa')) casillas.add('papa');
  }
  return casillas;
}

/* ── Ficha normalizada ─────────────────────────────────────────────────── */

export interface FichaSca {
  intensidad: Record<AtributoHoja, number | null>;
  calidad: Record<AtributoHoja, number | null>;
  impresionGlobal: number | null;
  /** Casillas marcadas del bloque Fragancia/Aroma. */
  olfativo: Set<string>;
  /** Casillas marcadas del bloque Sabor/Sabor residual. */
  gustativo: Set<string>;
  gustos: Set<string>;
  boca: Set<string>;
  defectos: Set<string>;
  tazasNoUniformes: number | null;
  tazasDefectuosas: number | null;
  puntaje: number | null;
  notas: NotasHoja;
}

export interface NotasHoja {
  olfativo: string;
  gustativo: string;
  acidez: string;
  dulzor: string;
  boca: string;
  otras: string;
}

type Registro = Record<string, unknown>;
const comoRegistro = (v: unknown): Registro => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Registro) : {});
const comoTextos = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
const comoTexto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const numeroEn = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const unir = (...partes: string[]): string => partes.filter(Boolean).join(' · ');

type FichaCatador = CupperResultSummary['puntajesPorMuestra'][number];

/** Lee una ficha (RPC + JSON del formulario) en la forma de la hoja SCA. */
export function leerFichaSca(ficha: FichaCatador): FichaSca {
  const formulario = comoRegistro(ficha.formulario);
  // Combinado guarda los atributos bajo `atributos`; Descriptivo, en la raíz.
  const bloque = (a: AtributoHoja): Registro =>
    comoRegistro(comoRegistro(formulario['atributos'])[CLAVE_FORMULARIO[a]] ?? formulario[CLAVE_FORMULARIO[a]]);

  const intensidad = {} as Record<AtributoHoja, number | null>;
  const calidad = {} as Record<AtributoHoja, number | null>;
  for (const a of ATRIBUTOS_HOJA) {
    const db = ficha.atributos[a];
    const json = bloque(a);
    intensidad[a] = db?.intensidad ?? numeroEn(json['intensidad'], 0, 15);
    calidad[a] = db?.calidad ?? numeroEn(json['calidad'], 1, 9);
  }

  const descriptores = (atributos: AtributoHoja[]) => atributos.flatMap(a => comoTextos(bloque(a)['descriptores']));
  const extras = (atributos: AtributoHoja[]) => atributos.map(a => comoTexto(bloque(a)['extra'])).filter(Boolean);
  const listar = (nombres: string[]) => (nombres.length ? `Descriptores: ${[...new Set(nombres)].join(', ')}` : '');

  const olfativos = descriptores(['fragancia', 'aroma']);
  const gustativos = descriptores(['sabor', 'sabor_residual']);
  const boca = [...comoTextos(formulario['mouthfeel']), ...comoTextos(bloque('sensacion_boca')['textura'])];
  const defectos = comoTextos(formulario['tiposDefecto']);
  const defectosSinCasilla = defectos.filter(d => casillasDeDefectos([d]).size === 0);
  const tazas = comoRegistro(formulario['defectos']);

  return {
    intensidad,
    calidad,
    impresionGlobal: ficha.impresionGlobal ?? numeroEn(formulario['impresionGlobal'], 1, 9),
    olfativo: casillasDeDescriptores(olfativos),
    gustativo: casillasDeDescriptores(gustativos),
    gustos: new Set<string>(),
    boca: casillasDeBoca(boca),
    defectos: casillasDeDefectos(defectos),
    tazasNoUniformes: numeroEn(ficha.tazasNoUniformes ?? tazas['tazasNoUniformes'], 0, 5),
    tazasDefectuosas: numeroEn(ficha.tazasDefectuosas ?? tazas['tazasDefectuosas'], 0, 5),
    puntaje: ficha.puntaje > 0 ? ficha.puntaje : null,
    notas: {
      olfativo: unir(listar(olfativos), ...extras(['fragancia', 'aroma'])),
      gustativo: unir(listar(gustativos), ...extras(['sabor', 'sabor_residual'])),
      acidez: comoTexto(bloque('acidez')['nota']),
      dulzor: comoTexto(bloque('dulzor')['nota']),
      boca: comoTexto(formulario['notasMouthfeel']),
      otras: unir(comoTexto(formulario['notas']), defectosSinCasilla.length ? `Otros defectos: ${defectosSinCasilla.join(', ')}` : '')
    }
  };
}

/* ── Consolidación del panel ───────────────────────────────────────────── */

const promedio = (valores: (number | null)[]): number | null => {
  const v = valores.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((t, x) => t + x, 0) / v.length) * 100) / 100 : null;
};

/** Casillas marcadas por MÁS del 50 % de las fichas (regla de mayoría). */
export function mayoria(conjuntos: readonly Set<string>[]): Set<string> {
  const conteo = new Map<string, number>();
  for (const c of conjuntos) for (const clave of c) conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  return new Set([...conteo].filter(([, n]) => n / conjuntos.length > 0.5).map(([clave]) => clave));
}

const NOTA_PANEL = 'Ver reporte individual de cada catador.';

/**
 * Consolida fichas de los catadores seleccionados:
 *  · Intensidades (sliders): promedio.
 *  · Casillas: regla de mayoría (> 50 % de las fichas).
 *  · Calidad 1–9 y tazas: promedio (los círculos pintan el entero más cercano).
 */
export function consolidarFichas(fichas: readonly FichaSca[], resumenNotas: string): FichaSca {
  const intensidad = {} as Record<AtributoHoja, number | null>;
  const calidad = {} as Record<AtributoHoja, number | null>;
  for (const a of ATRIBUTOS_HOJA) {
    intensidad[a] = promedio(fichas.map(f => f.intensidad[a]));
    calidad[a] = promedio(fichas.map(f => f.calidad[a]));
  }
  return {
    intensidad,
    calidad,
    impresionGlobal: promedio(fichas.map(f => f.impresionGlobal)),
    olfativo: mayoria(fichas.map(f => f.olfativo)),
    gustativo: mayoria(fichas.map(f => f.gustativo)),
    gustos: mayoria(fichas.map(f => f.gustos)),
    boca: mayoria(fichas.map(f => f.boca)),
    defectos: mayoria(fichas.map(f => f.defectos)),
    tazasNoUniformes: promedio(fichas.map(f => f.tazasNoUniformes)),
    tazasDefectuosas: promedio(fichas.map(f => f.tazasDefectuosas)),
    puntaje: promedio(fichas.map(f => f.puntaje)),
    notas: {
      olfativo: NOTA_PANEL,
      gustativo: NOTA_PANEL,
      acidez: NOTA_PANEL,
      dulzor: NOTA_PANEL,
      boca: NOTA_PANEL,
      otras: resumenNotas
    }
  };
}

/** Punto de la escala 1–9 que se pinta: el entero más cercano al valor. */
export function circuloMarcado(valor: number | null): number | null {
  return valor === null ? null : Math.min(9, Math.max(1, Math.round(valor)));
}

export function etiquetaCalidad(valor: number | null): string {
  const n = circuloMarcado(valor);
  return n === null ? '' : `${n} · ${ETIQUETAS_HEDONICAS[n] ?? ''}`;
}

/** Puntaje del panel con la misma regla que la RPC: recortado con N ≥ 5. */
export function puntajePanel(puntajes: readonly number[]): number | null {
  if (puntajes.length === 0) return null;
  const orden = [...puntajes].sort((a, b) => a - b);
  const usados = orden.length >= 5 ? orden.slice(1, -1) : orden;
  return Math.round((usados.reduce((t, x) => t + x, 0) / usados.length) * 100) / 100;
}

/* ── Hoja completa ─────────────────────────────────────────────────────── */

export interface ResumenPanelHoja {
  puntaje: number | null;
  clasificacion: string;
  fichas: string;
  minMax: string;
  recortado: boolean;
}

export interface HojaSca {
  formato: FormatoHoja;
  titulo: string;
  esPanel: boolean;
  nombre: string;
  fecha: string;
  objetivo: string;
  numeroMuestra: number;
  nivelTueste: string | null;
  ficha: FichaSca;
  resumenPanel: ResumenPanelHoja | null;
}
