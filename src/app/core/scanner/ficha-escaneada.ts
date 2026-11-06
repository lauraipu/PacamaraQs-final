import { RUEDA_SABORES } from '../cva/cva';
import { aTitulo, TIPOS_PROCESO } from '../cva/origenes';
import { parsearNumeroEs } from '../utils/numeros';

export { parsearNumeroEs };

/**
 * Lógica pura del escáner de fichas (sin Angular ni red, para poder probarla):
 *  · El JSON que devuelve la IA sigue la forma de los formularios de la app
 *    (el esquema y el prompt están en la Edge Function `analizar-ficha`).
 *  · Saneamiento de la respuesta: rangos SCA, pasos de 0.5, descriptores
 *    canónicos. Nunca se confía en lo que devuelve el modelo.
 *  · Respuestas simuladas para cuando no hay llave de API.
 */

export type FormatoEscaneo = 'combinado' | 'descriptivo' | 'afectivo' | 'extrinseca';

export const FORMATOS_ESCANEO: readonly { id: FormatoEscaneo; titulo: string }[] = [
  { id: 'combinado', titulo: 'Combinado' },
  { id: 'descriptivo', titulo: 'Descriptivo' },
  { id: 'afectivo', titulo: 'Afectivo' },
  { id: 'extrinseca', titulo: 'Extrínseco' }
];

export type AtributoDb =
  | 'fragancia' | 'aroma' | 'sabor' | 'sabor_residual' | 'acidez' | 'dulzor' | 'sensacion_boca';

/** Clave camelCase del formulario → nombre en evaluacion_atributos. */
const ATRIBUTOS: readonly { form: string; db: AtributoDb; etiqueta: string }[] = [
  { form: 'fragancia', db: 'fragancia', etiqueta: 'Fragancia' },
  { form: 'aroma', db: 'aroma', etiqueta: 'Aroma' },
  { form: 'sabor', db: 'sabor', etiqueta: 'Sabor' },
  { form: 'saborResidual', db: 'sabor_residual', etiqueta: 'Sabor residual' },
  { form: 'acidez', db: 'acidez', etiqueta: 'Acidez' },
  { form: 'dulzor', db: 'dulzor', etiqueta: 'Dulzor' },
  { form: 'sensacionEnBoca', db: 'sensacion_boca', etiqueta: 'Sensación en boca' }
];
const CON_DESCRIPTORES = new Set(['fragancia', 'aroma', 'sabor', 'saborResidual']);

export interface AtributoEscaneado {
  atributo: AtributoDb;
  etiqueta: string;
  intensidad: number | null;
  calidad: number | null;
}

/** Ficha ya saneada, lista para revisar y guardar. */
export interface FichaEscaneada {
  formato: FormatoEscaneo;
  /**
   * JSON con la misma forma que guarda el formulario de la app (evaluaciones.notas).
   * Los valores ilegibles quedan en null: nunca se rellenan con 0 o 5.
   */
  formulario: Record<string, unknown>;
  atributos: AtributoEscaneado[];
  impresionGlobal: number | null;
  tazasNoUniformes: number;
  tazasDefectuosas: number;
  /** Puntaje CVA calculado localmente (vista previa; el servidor lo recalcula). */
  puntaje: number | null;
  descriptores: string[];
  /** Campos que la IA no pudo leer (null): se avisan en la revisión. */
  camposFaltantes: string[];
  simulada: boolean;
}

export function tituloFormatoEscaneo(formato: FormatoEscaneo): string {
  return FORMATOS_ESCANEO.find(f => f.id === formato)?.titulo ?? formato;
}

// El esquema JSON y el prompt viven en la Edge Function `analizar-ficha`
// (supabase/functions/analizar-ficha): el cliente solo envía formato + imagen.

/** Gustos predominantes de la hoja SCA (máximo 2). */
export const GUSTOS_PREDOMINANTES = ['salado', 'amargo', 'acido', 'umami', 'dulce'] as const;
export type GustoPredominante = typeof GUSTOS_PREDOMINANTES[number];

/* ── Saneamiento ───────────────────────────────────────────────────────── */

type Registro = Record<string, unknown>;
const reg = (v: unknown): Registro => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Registro) : {});
const texto = (v: unknown, max = 500): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const textos = (v: unknown, max = 12): string[] =>
  Array.isArray(v) ? v.map(x => texto(x, 60)).filter(Boolean).slice(0, max) : [];
const numero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Intensidad 0–15 redondeada a pasos de 0.5. */
export function sanearIntensidad(v: unknown): number | null {
  const n = numero(v);
  return n === null ? null : Math.min(15, Math.max(0, Math.round(n * 2) / 2));
}

/** Entero 1–9 o null. */
export function sanearCalidad(v: unknown): number | null {
  const n = numero(v);
  if (n === null) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 9 ? r : null;
}

export const sanearTazas = (v: unknown): number => {
  const n = numero(v);
  return n === null ? 0 : Math.min(5, Math.max(0, Math.round(n)));
};

const normalizar = (t: string): string =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();

/** Vocabulario de la app (categorías + subdescriptores) y etiquetas de la hoja SCA. */
const DESCRIPTOR_CANONICO: ReadonlyMap<string, string> = new Map([
  ...Object.entries(RUEDA_SABORES).flatMap(([cat, { subdescriptores }]) =>
    [[normalizar(cat), cat] as const, ...subdescriptores.map(s => [normalizar(s), s] as const)]
  ),
  [normalizar('Otra'), 'Otro'],
  [normalizar('Ácido'), 'Ácido / Fermentado'],
  [normalizar('Nueces/Cacao'), 'Nueces / Cacao']
]);

/** Usa el nombre de la app cuando existe; si no, conserva el texto leído. */
export function canonizarDescriptores(valores: unknown): string[] {
  return [...new Set(textos(valores).map(v => DESCRIPTOR_CANONICO.get(normalizar(v)) ?? v))];
}

/** Puntaje CVA: S = 0.65625·Σhᵢ + 52.75 − 2u − 4d (redondeado a 0.25). */
export function calcularPuntajeCva(calidades: (number | null)[], impresion: number | null, u: number, d: number): number | null {
  const todas = [...calidades, impresion];
  if (todas.length !== 8 || todas.some(c => c === null)) return null;
  const suma = (todas as number[]).reduce((t, c) => t + c, 0);
  const s = 0.65625 * suma + 52.75 - 2 * u - 4 * d;
  return Math.max(0, Math.min(100, Math.round(s * 4) / 4));
}

/** Gustos predominantes válidos, sin repetir y máximo 2. */
export function sanearGustos(v: unknown): GustoPredominante[] {
  const validos = textos(v, 10)
    .map(t => normalizar(t))
    .filter((t): t is GustoPredominante => (GUSTOS_PREDOMINANTES as readonly string[]).includes(t));
  return [...new Set(validos)].slice(0, 2);
}

/** Número ≥ 0 (precio, tamaño de lote) o null. Acepta "25.000" / "25,5" / "$ 25.000". */
export function sanearNumeroPositivo(v: unknown, max = 1e12): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 && v <= max ? v : null;
  if (typeof v !== 'string') return null;
  const n = parsearNumeroEs(v);
  return n !== null && n >= 0 && n <= max ? n : null;
}

/** Extrae el primer objeto JSON de la respuesta (tolera ```json … ```). */
export function extraerJson(respuesta: string): Registro {
  const limpio = respuesta.replace(/```(?:json)?/gi, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio < 0 || fin <= inicio) throw new Error('La IA no devolvió un JSON válido.');
  const datos = JSON.parse(limpio.slice(inicio, fin + 1)) as unknown;
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('La IA no devolvió un objeto JSON.');
  return datos as Registro;
}

/** Convierte la respuesta cruda de la IA en una ficha saneada con la forma del formulario de la app. */
export function sanearFicha(crudo: Registro, formato: FormatoEscaneo, simulada: boolean): FichaEscaneada {
  const faltantes: string[] = [];
  const atributos: AtributoEscaneado[] = [];
  const descriptores: string[] = [];
  let formulario: Registro;
  let impresion: number | null = null;
  let u = 0;
  let d = 0;

  if (formato === 'combinado') {
    const fuente = reg(crudo['atributos']);
    const salida: Registro = {};
    for (const a of ATRIBUTOS) {
      const bloque = reg(fuente[a.form]);
      const intensidad = sanearIntensidad(bloque['intensidad']);
      const calidad = sanearCalidad(bloque['calidad']);
      if (intensidad === null) faltantes.push(`${a.etiqueta} · intensidad`);
      if (calidad === null) faltantes.push(`${a.etiqueta} · calidad`);
      atributos.push({ atributo: a.db, etiqueta: a.etiqueta, intensidad, calidad });
      if (CON_DESCRIPTORES.has(a.form)) {
        const lista = canonizarDescriptores(bloque['descriptores']);
        descriptores.push(...lista);
        salida[a.form] = { intensidad, calidad, descriptores: lista, extra: '' };
      } else {
        salida[a.form] = { intensidad, calidad };
      }
    }
    impresion = sanearCalidad(crudo['impresionGlobal']);
    u = sanearTazas(crudo['tazasNoUniformes']);
    d = sanearTazas(crudo['tazasDefectuosas']);
    const tiposDefecto = textos(crudo['tiposDefecto'], 5);
    d = Math.max(d, tiposDefecto.length > 0 ? 1 : 0);
    formulario = {
      atributos: salida,
      gustosPredominantes: sanearGustos(crudo['gustosPredominantes']),
      impresionGlobal: impresion,
      mouthfeel: textos(crudo['mouthfeel'], 5),
      notasMouthfeel: '',
      defectos: { tazasNoUniformes: u, tazasDefectuosas: d },
      tiposDefecto,
      notas: texto(crudo['notas'])
    };
  } else if (formato === 'descriptivo') {
    formulario = { notas: texto(crudo['notas']), gustosPredominantes: sanearGustos(crudo['gustosPredominantes']) };
    for (const a of ATRIBUTOS) {
      const bloque = reg(crudo[a.form]);
      const intensidad = sanearIntensidad(bloque['intensidad']);
      if (intensidad === null) faltantes.push(`${a.etiqueta} · intensidad`);
      atributos.push({ atributo: a.db, etiqueta: a.etiqueta, intensidad, calidad: null });
      if (CON_DESCRIPTORES.has(a.form)) {
        const lista = canonizarDescriptores(bloque['descriptores']);
        descriptores.push(...lista);
        formulario[a.form] = { intensidad, descriptores: lista, extra: '' };
      } else if (a.form === 'sensacionEnBoca') {
        formulario[a.form] = { intensidad, textura: textos(bloque['textura'], 5) };
      } else {
        formulario[a.form] = { intensidad, nota: texto(bloque['nota'], 200) };
      }
    }
  } else if (formato === 'afectivo') {
    formulario = { notas: texto(crudo['notas']) };
    for (const a of ATRIBUTOS) {
      const calidad = sanearCalidad(crudo[a.form]);
      if (calidad === null) faltantes.push(`${a.etiqueta} · calidad`);
      atributos.push({ atributo: a.db, etiqueta: a.etiqueta, intensidad: null, calidad });
      formulario[a.form] = calidad;
    }
    impresion = sanearCalidad(crudo['impresionGlobal']);
    u = sanearTazas(crudo['tazasNoUniformes']);
    d = sanearTazas(crudo['tazasDefectuosas']);
    formulario['impresionGlobal'] = impresion;
    formulario['defectos'] = { tazasNoUniformes: u, tazasDefectuosas: d };
  } else {
    const f = reg(crudo['farming']);
    const p = reg(crudo['processing']);
    const t = reg(crudo['trading']);
    const c = reg(crudo['certifications']);
    const tipo = texto(p['processType'], 20).toLowerCase();
    formulario = {
      farming: Object.fromEntries(['country', 'region', 'farmName', 'producers', 'species', 'variety', 'harvestDate', 'other']
        .map(k => [k, ['farmName', 'producers'].includes(k) ? aTitulo(texto(f[k], 120)) : texto(f[k], 120)])),
      processing: {
        processorName: aTitulo(texto(p['processorName'], 120)), wetMill: texto(p['wetMill'], 120), dryMill: texto(p['dryMill'], 120),
        processType: TIPOS_PROCESO.some(x => x.valor === tipo) ? tipo : '',
        decaf: texto(p['decaf'], 60), description: texto(p['description'], 200), other: texto(p['other'], 200)
      },
      trading: {
        importer: aTitulo(texto(t['importer'], 120)), exporter: aTitulo(texto(t['exporter'], 120)),
        grade: texto(t['grade'], 60), icoNumber: texto(t['icoNumber'], 60), currency: texto(t['currency'], 3).toUpperCase() || 'COP',
        farmPrice: sanearNumeroPositivo(t['farmPrice']), lotSizeKg: sanearNumeroPositivo(t['lotSizeKg'], 1e9),
        other: texto(t['other'], 200)
      },
      certifications: {
        c4: c['c4'] === true, fairTrade: c['fairTrade'] === true, organic: c['organic'] === true,
        rainforest: c['rainforest'] === true, other: texto(c['other'], 120)
      },
      notes: texto(crudo['notes'])
    };
    if (!texto(f['country'])) faltantes.push('País');
    if (!texto(f['variety'])) faltantes.push('Variedad');
  }

  if ((formato === 'combinado' || formato === 'afectivo') && impresion === null) faltantes.push('Impresión global');
  const puntaje = formato === 'combinado' || formato === 'afectivo'
    ? calcularPuntajeCva(atributos.map(a => a.calidad), impresion, u, d)
    : null;

  return {
    formato,
    formulario,
    atributos,
    impresionGlobal: impresion,
    tazasNoUniformes: u,
    tazasDefectuosas: d,
    puntaje,
    descriptores: [...new Set([
      ...descriptores,
      ...(formato === 'combinado' || formato === 'descriptivo' ? canonizarDescriptores(crudo['descriptores']) : [])
    ])],
    camposFaltantes: faltantes,
    simulada
  };
}

/** Cuerpo para la RPC registrar_ficha_personal (el servidor vuelve a validar y recalcula el puntaje). */
/** Valores corregidos a mano en la pantalla de revisión del escáner. */
export interface CorreccionFicha {
  atributos: { atributo: AtributoDb; intensidad: number | null; calidad: number | null }[];
  impresionGlobal: number | null;
  tazasNoUniformes: number;
  tazasDefectuosas: number;
}

/**
 * Aplica las correcciones del usuario a la ficha: atributos, impresión global
 * y tazas se escriben en `formulario` con la misma forma que cada formulario
 * de la app, y el puntaje CVA se recalcula (nunca se confía en el de la IA).
 */
export function aplicarCorrecciones(ficha: FichaEscaneada, c: CorreccionFicha): FichaEscaneada {
  if (ficha.formato === 'extrinseca') return ficha;
  const formulario: Registro = structuredClone(ficha.formulario);
  const conCalidad = ficha.formato !== 'descriptivo';
  const conIntensidad = ficha.formato !== 'afectivo';
  const faltantes: string[] = [];

  const atributos = ATRIBUTOS.map(a => {
    const original = ficha.atributos.find(x => x.atributo === a.db);
    const editado = c.atributos.find(x => x.atributo === a.db);
    const intensidad = conIntensidad ? sanearIntensidad(editado?.intensidad ?? null) : null;
    const calidad = conCalidad ? sanearCalidad(editado?.calidad ?? null) : null;
    if (conIntensidad && intensidad === null) faltantes.push(`${a.etiqueta} · intensidad`);
    if (conCalidad && calidad === null) faltantes.push(`${a.etiqueta} · calidad`);

    if (ficha.formato === 'afectivo') {
      formulario[a.form] = calidad;
    } else {
      const raiz = ficha.formato === 'combinado' ? reg(formulario['atributos']) : formulario;
      const bloque = reg(raiz[a.form]);
      raiz[a.form] = conCalidad ? { ...bloque, intensidad, calidad } : { ...bloque, intensidad };
      if (ficha.formato === 'combinado') formulario['atributos'] = raiz;
    }
    return { atributo: a.db, etiqueta: original?.etiqueta ?? a.etiqueta, intensidad, calidad };
  });

  const impresion = conCalidad ? sanearCalidad(c.impresionGlobal) : null;
  const u = conCalidad ? sanearTazas(c.tazasNoUniformes) : 0;
  const d = conCalidad ? sanearTazas(c.tazasDefectuosas) : 0;
  if (conCalidad) {
    if (impresion === null) faltantes.push('Impresión global');
    formulario['impresionGlobal'] = impresion;
    formulario['defectos'] = { tazasNoUniformes: u, tazasDefectuosas: d };
  }
  return {
    ...ficha,
    formulario,
    atributos,
    impresionGlobal: impresion,
    tazasNoUniformes: u,
    tazasDefectuosas: d,
    puntaje: conCalidad ? calcularPuntajeCva(atributos.map(a => a.calidad), impresion, u, d) : null,
    camposFaltantes: faltantes
  };
}

export function payloadFichaPersonal(ficha: FichaEscaneada): Registro {
  return {
    impresion_global: ficha.impresionGlobal,
    tazas_no_uniformes: ficha.tazasNoUniformes,
    tazas_defectuosas: ficha.tazasDefectuosas,
    atributos: ficha.atributos
      .filter(a => a.intensidad !== null || a.calidad !== null)
      .map(a => ({ atributo: a.atributo, intensidad: a.intensidad, calidad: a.calidad })),
    formulario: ficha.formulario
  };
}

/* ── Respuestas simuladas (sin llave de API) ───────────────────────────── */

export function respuestaSimulada(formato: FormatoEscaneo): Registro {
  switch (formato) {
    case 'combinado':
      return {
        atributos: {
          fragancia: { intensidad: 9, calidad: 8, descriptores: ['Floral', 'Bayas'] },
          aroma: { intensidad: 8.5, calidad: 8, descriptores: ['Nueces/Cacao', 'Cacao'] },
          sabor: { intensidad: 10, calidad: 8, descriptores: ['Cítricos', 'Azúcar morena'] },
          saborResidual: { intensidad: 8, calidad: 7, descriptores: [] },
          acidez: { intensidad: 9.5, calidad: 8 },
          dulzor: { intensidad: 8, calidad: 8 },
          sensacionEnBoca: { intensidad: 8.5, calidad: 7 }
        },
        impresionGlobal: 8,
        mouthfeel: ['Suave (aterciopelado, sedoso)'],
        tazasNoUniformes: 0,
        tazasDefectuosas: 0,
        tiposDefecto: [],
        gustosPredominantes: ['dulce', 'acido'],
        notas: 'Ficha simulada (escanerSimulado = true).'
      };
    case 'descriptivo':
      return {
        fragancia: { intensidad: 8.5, descriptores: ['Floral', 'Jazmín'] },
        aroma: { intensidad: 9, descriptores: ['Chocolate'] },
        sabor: { intensidad: 10.5, descriptores: ['Cítricos', 'Miel'] },
        saborResidual: { intensidad: 7, descriptores: [] },
        acidez: { intensidad: 11, nota: 'cítrica' },
        dulzor: { intensidad: 6.5, nota: '' },
        sensacionEnBoca: { intensidad: 8, textura: ['Suave'] },
        gustosPredominantes: ['acido'],
        notas: 'Ficha simulada (escanerSimulado = true).'
      };
    case 'afectivo':
      return {
        fragancia: 8, aroma: 8, sabor: 7, saborResidual: 7, acidez: 8, dulzor: 7, sensacionEnBoca: 7,
        impresionGlobal: 8, tazasNoUniformes: 0, tazasDefectuosas: 0,
        notas: 'Ficha simulada (escanerSimulado = true).'
      };
    default:
      return {
        farming: { country: 'El Salvador', region: 'Apaneca-Ilamatepec', farmName: 'Finca de ejemplo', producers: '',
          species: 'Arábica', variety: 'Pacamara', harvestDate: '2026-02', other: '' },
        processing: { processorName: '', wetMill: '', dryMill: '', processType: 'natural', other: '' },
        trading: { grade: 'SHG', icoNumber: '', farmPrice: 25000, lotSizeKg: 690, other: '' },
        certifications: { c4: false, fairTrade: true, organic: false, rainforest: false, other: '' },
        notes: 'Ficha simulada (escanerSimulado = true).'
      };
  }
}
