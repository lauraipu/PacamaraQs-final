import type { Workbook, Worksheet } from 'exceljs';
import { CupperResultSummary, SessionResults } from '../models/session-results.model';
import { tr } from '../i18n/tr';

/**
 * Reporte Excel (.xlsx) de una sesión, de lo general al detalle:
 *   1. Sesión · 2. Resumen por muestra · 3. Afectivo · 4. Descriptivo · 5. Datos crudos
 *   (Extrínseco: Sesión + Fichas técnicas).
 *
 * exceljs se carga con import() dinámico: solo se descarga al exportar y no
 * pesa en el arranque de la app.
 */

type Registro = Record<string, unknown>;
type FormatoId = 'combinado' | 'afectivo' | 'descriptivo' | 'extrinseca' | string;

/** Orden de la hoja SCA. `form` = clave en el JSON del formulario. */
const ATRIBUTOS = [
  { db: 'fragancia', form: 'fragancia', etiqueta: 'Fragancia', conDescriptores: true },
  { db: 'aroma', form: 'aroma', etiqueta: 'Aroma', conDescriptores: true },
  { db: 'sabor', form: 'sabor', etiqueta: 'Sabor', conDescriptores: true },
  { db: 'sabor_residual', form: 'saborResidual', etiqueta: 'Sabor residual', conDescriptores: true },
  { db: 'acidez', form: 'acidez', etiqueta: 'Acidez', conDescriptores: false },
  { db: 'dulzor', form: 'dulzor', etiqueta: 'Dulzor', conDescriptores: false },
  { db: 'sensacion_boca', form: 'sensacionEnBoca', etiqueta: 'Sensación en boca', conDescriptores: false }
] as const;

const TITULO_FORMATO: Record<string, string> = {
  combinado: 'Combinado (Descriptivo + Afectivo)',
  afectivo: 'Afectivo',
  descriptivo: 'Descriptivo',
  extrinseca: 'Extrínseco'
};

/** Umbrales de alerta del resumen por muestra. */
const DISPERSION_DESV = 3;
const DISPERSION_RANGO = 10;

const COLOR_CABECERA = 'FF2F3E46';

const reg = (v: unknown): Registro => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Registro) : {});
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);
const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const redondear = (n: number, d = 2): number => Math.round(n * 10 ** d) / 10 ** d;

interface Fila {
  catador: CupperResultSummary;
  numeroMuestra: number;
  puntaje: number | null;
  impresionGlobal: number | null;
  u: number;
  d: number;
  atributos: Partial<Record<string, { intensidad: number | null; calidad: number | null }>>;
  formulario: Registro;
}

export interface ArchivoXlsx { blob: Blob; nombre: string; }

export async function generarReporteXlsx(r: SessionResults, fechaExportacion = new Date()): Promise<ArchivoXlsx> {
  const ExcelJS = (await import('exceljs')).default;
  const libro: Workbook = new ExcelJS.Workbook();
  libro.creator = 'PacamaraQs';
  libro.created = fechaExportacion;

  const formato: FormatoId = r.formatoCva;
  const codigo = r.codigoSesion || r.sesionId.slice(0, 8).toUpperCase();
  const fichas = filasDe(r);

  hojaSesion(libro, r, codigo, fechaExportacion, fichas);
  if (formato === 'extrinseca') {
    hojaFichasTecnicas(libro, r);
  } else {
    hojaResumen(libro, r, fichas, formato);
    if (formato !== 'descriptivo') hojaAfectivo(libro, fichas);
    if (formato !== 'afectivo') hojaDescriptivo(libro, fichas, formato);
    hojaCrudos(libro, fichas, codigo, formato);
  }

  const buffer = await libro.xlsx.writeBuffer();
  const fecha = (r.creadaEn ? new Date(r.creadaEn) : fechaExportacion).toISOString().slice(0, 10);
  const nombreFormato = { combinado: 'Combinado', afectivo: 'Afectivo', descriptivo: 'Descriptivo', extrinseca: 'Extrinseco' }[formato] ?? 'Sesion';
  return {
    blob: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nombre: `PacamaraQs_${nombreFormato}_${codigo}_${fecha}.xlsx`
  };
}

/* ── Datos ──────────────────────────────────────────────────────────────── */

function filasDe(r: SessionResults): Fila[] {
  return r.catadores
    .flatMap(c => c.puntajesPorMuestra.map(p => ({
      catador: c,
      numeroMuestra: p.numeroMuestra,
      puntaje: p.puntaje > 0 ? p.puntaje : null,
      impresionGlobal: p.impresionGlobal,
      u: p.tazasNoUniformes,
      d: p.tazasDefectuosas,
      atributos: p.atributos as Fila['atributos'],
      formulario: reg(p.formulario)
    })))
    .sort((a, b) => a.numeroMuestra - b.numeroMuestra || a.catador.nombre.localeCompare(b.catador.nombre, 'es'));
}

/** Bloque del atributo en el JSON (Combinado: bajo `atributos`; Descriptivo: en la raíz). */
const bloque = (f: Fila, form: string): Registro => reg(reg(f.formulario['atributos'])[form] ?? f.formulario[form]);

const calidadesCompletas = (f: Fila): boolean =>
  ATRIBUTOS.every(a => f.atributos[a.db]?.calidad != null) && f.impresionGlobal != null;

const rol = (c: CupperResultSummary): string => tr(c.esOrganizador ? 'Organizador' : 'Catador');

/* ── Hojas ──────────────────────────────────────────────────────────────── */

function hojaSesion(libro: Workbook, r: SessionResults, codigo: string, exportado: Date, fichas: Fila[]): void {
  const h = libro.addWorksheet(tr('Sesión'));
  h.columns = [{ header: tr('Campo'), key: 'campo', width: 24 }, { header: tr('Valor'), key: 'valor', width: 48 }];
  const organizador = r.catadores.find(c => c.esOrganizador)?.nombre ?? '';
  const filas: [string, string | number][] = [
    [tr('Sesión'), r.nombreSesion],
    [tr('Código'), codigo],
    [tr('Formato'), tr(TITULO_FORMATO[r.formatoCva] ?? r.formatoCva)],
    [tr('Fecha de la sesión'), r.creadaEn ? new Date(r.creadaEn).toLocaleDateString('es-CO') : ''],
    [tr('Exportado el'), exportado.toLocaleString('es-CO')],
    [tr('Organizador'), organizador],
    [tr('Catadores'), r.catadores.length],
    [tr('Muestras'), r.totalMuestras],
    [tr('Fichas recibidas'), fichas.length],
    [tr('Nivel de tueste'), [...new Set(r.muestras.map(m => m.nivelTueste).filter(Boolean))].join(', ')],
    [tr('Metodología'), 'SCA Coffee Value Assessment (CVA) v2 · S = 0,65625·Σhᵢ + 52,75 − 2u − 4d'],
    [tr('Promedio del panel'), tr('Incluye al organizador cuando participa como catador. Con 5 o más fichas se descartan máximo y mínimo.')]
  ];
  filas.forEach(([campo, valor]) => h.addRow({ campo, valor }));
  estilizar(h, false);
  h.getColumn(1).font = { bold: true };
}

function hojaResumen(libro: Workbook, r: SessionResults, fichas: Fila[], formato: FormatoId): void {
  const h = libro.addWorksheet(tr('Resumen por muestra'));
  h.columns = [
    { header: tr('Muestra'), key: 'muestra', width: 9 },
    { header: tr('Nivel de tueste'), key: 'tueste', width: 15 },
    { header: tr('Promedio panel'), key: 'promedio', width: 15, style: { numFmt: '0.00' } },
    { header: tr('Desv. estándar'), key: 'desv', width: 14, style: { numFmt: '0.00' } },
    { header: tr('Mín'), key: 'min', width: 9, style: { numFmt: '0.00' } },
    { header: tr('Máx'), key: 'max', width: 9, style: { numFmt: '0.00' } },
    { header: tr('Rango'), key: 'rango', width: 9, style: { numFmt: '0.00' } },
    { header: tr('Fichas'), key: 'n', width: 9 },
    { header: tr('Promedio recortado'), key: 'recortado', width: 18 },
    { header: tr('Alertas'), key: 'alertas', width: 60 }
  ];
  for (const m of [...r.muestras].sort((a, b) => a.numeroMuestra - b.numeroMuestra)) {
    const deMuestra = fichas.filter(f => f.numeroMuestra === m.numeroMuestra);
    const conPuntaje = deMuestra.filter(f => f.puntaje !== null).map(f => f.puntaje as number);
    const usaPuntaje = formato !== 'descriptivo' && conPuntaje.length > 0;
    const min = usaPuntaje ? Math.min(...conPuntaje) : null;
    const max = usaPuntaje ? Math.max(...conPuntaje) : null;
    const rango = min !== null && max !== null ? redondear(max - min) : null;

    const alertas: string[] = [];
    const incompletas = formato === 'descriptivo' ? [] : deMuestra.filter(f => f.puntaje !== null && !calidadesCompletas(f));
    if (incompletas.length) alertas.push(tr('⚠ Ficha incompleta (sin atributos guardados): {{p0}}', { p0: incompletas.map(f => f.catador.nombre).join(', ') }));
    if (usaPuntaje && (m.desviacionEstandar >= DISPERSION_DESV || (rango ?? 0) >= DISPERSION_RANGO)) alertas.push(tr('⚠ Dispersión alta en el panel'));
    if (m.evaluacionesRecibidas < m.evaluacionesEsperadas) alertas.push(tr('Faltan fichas'));
    if (m.cerradaForzada) alertas.push(tr('Cerrada por el organizador'));

    h.addRow({
      muestra: m.numeroMuestra,
      tueste: m.nivelTueste ?? '',
      promedio: usaPuntaje ? m.puntajePromedioPanel : null,
      desv: usaPuntaje ? m.desviacionEstandar : null,
      min, max, rango,
      n: `${deMuestra.length} / ${m.evaluacionesEsperadas || r.catadores.length}`,
      recortado: m.recortado ? tr('Sí (N ≥ 5)') : tr('No'),
      alertas: alertas.join(' · ') || '—'
    });
  }
  estilizar(h);
}

function hojaAfectivo(libro: Workbook, fichas: Fila[]): void {
  const h = libro.addWorksheet(tr('Afectivo (1-9)'));
  h.columns = [
    { header: tr('Muestra'), key: 'muestra', width: 9 },
    { header: tr('Catador'), key: 'catador', width: 18 },
    { header: tr('Rol'), key: 'rol', width: 12 },
    ...ATRIBUTOS.map(a => ({ header: tr(a.etiqueta), key: a.db, width: 11 })),
    { header: tr('Impresión global'), key: 'ig', width: 11 },
    { header: tr('Σ Calidades'), key: 'suma', width: 11 },
    { header: tr('Tazas no unif.'), key: 'u', width: 10 },
    { header: tr('Tazas defect.'), key: 'd', width: 10 },
    { header: tr('Penalización'), key: 'pen', width: 12 },
    { header: tr('Puntaje final'), key: 'puntaje', width: 12, style: { numFmt: '0.00' } },
    { header: tr('Estado'), key: 'estado', width: 26 }
  ];
  for (const f of fichas) {
    const cal = ATRIBUTOS.map(a => f.atributos[a.db]?.calidad ?? null);
    const completa = calidadesCompletas(f);
    h.addRow({
      muestra: f.numeroMuestra,
      catador: f.catador.nombre,
      rol: rol(f.catador),
      ...Object.fromEntries(ATRIBUTOS.map((a, i) => [a.db, cal[i]])),
      ig: f.impresionGlobal,
      suma: completa ? cal.reduce<number>((t, c) => t + (c ?? 0), 0) + (f.impresionGlobal ?? 0) : null,
      u: f.u,
      d: f.d,
      pen: -(2 * f.u + 4 * f.d),
      puntaje: f.puntaje,
      estado: tr(completa ? 'Completa' : f.puntaje !== null ? '⚠ Incompleta (no verificable)' : 'Incompleta')
    });
  }
  estilizar(h);
}

function hojaDescriptivo(libro: Workbook, fichas: Fila[], formato: FormatoId): void {
  const h = libro.addWorksheet(tr('Descriptivo (0-15)'));
  h.columns = [
    { header: tr('Muestra'), key: 'muestra', width: 9 },
    { header: tr('Catador'), key: 'catador', width: 18 },
    ...ATRIBUTOS.flatMap(a => [
      { header: tr('{{p0}} int.', { p0: tr(a.etiqueta) }), key: `${a.db}_i`, width: 11, style: { numFmt: '0.0' } },
      ...(a.conDescriptores ? [{ header: tr('{{p0}} descriptores', { p0: tr(a.etiqueta) }), key: `${a.db}_d`, width: 26 }] : [])
    ]),
    { header: tr('Gustos predominantes'), key: 'gustos', width: 20 },
    { header: tr('Sensación en boca (textura)'), key: 'textura', width: 24 },
    ...(formato === 'combinado' ? [{ header: tr('Defectos'), key: 'defectos', width: 20 }] : []),
    { header: tr('Comentarios'), key: 'comentarios', width: 50 }
  ];
  for (const f of fichas) {
    const fila: Registro = { muestra: f.numeroMuestra, catador: f.catador.nombre };
    for (const a of ATRIBUTOS) {
      fila[`${a.db}_i`] = f.atributos[a.db]?.intensidad ?? null;
      if (a.conDescriptores) fila[`${a.db}_d`] = textos(bloque(f, a.form)['descriptores']).map(d => tr(d)).join(', ');
    }
    const notasAtributo = ATRIBUTOS
      .map(a => ({ a, t: texto(bloque(f, a.form)['extra']) || texto(bloque(f, a.form)['nota']) }))
      .filter(x => x.t)
      .map(x => `${tr(x.a.etiqueta)}: ${x.t}`);
    fila['gustos'] = textos(f.formulario['gustosPredominantes']).map(g => tr(g)).join(', ');
    fila['textura'] = [...textos(f.formulario['mouthfeel']), ...textos(bloque(f, 'sensacionEnBoca')['textura'])].map(t => tr(t)).join(', ');
    fila['defectos'] = textos(f.formulario['tiposDefecto']).map(t => tr(t)).join(', ');
    fila['comentarios'] = [...notasAtributo, texto(f.formulario['notasMouthfeel']), texto(f.formulario['notas'])].filter(Boolean).join(' | ');
    h.addRow(fila);
  }
  estilizar(h);
}

/** Formato largo (una fila por valor) para Power BI / análisis estadístico. */
function hojaCrudos(libro: Workbook, fichas: Fila[], codigo: string, formato: FormatoId): void {
  const h = libro.addWorksheet(tr('Datos crudos'));
  h.columns = [
    { header: 'sesion', key: 'sesion', width: 12 },
    { header: 'muestra', key: 'muestra', width: 9 },
    { header: 'catador', key: 'catador', width: 18 },
    { header: 'rol', key: 'rol', width: 12 },
    { header: 'atributo', key: 'atributo', width: 18 },
    { header: 'tipo', key: 'tipo', width: 11 },
    { header: 'valor', key: 'valor', width: 9 },
    { header: 'respondido', key: 'respondido', width: 11 }
  ];
  const tipos: ('calidad' | 'intensidad')[] =
    formato === 'afectivo' ? ['calidad'] : formato === 'descriptivo' ? ['intensidad'] : ['calidad', 'intensidad'];
  for (const f of fichas) {
    const base = { sesion: codigo, muestra: f.numeroMuestra, catador: f.catador.nombre, rol: rol(f.catador) };
    for (const a of ATRIBUTOS) {
      for (const tipo of tipos) {
        const valor = f.atributos[a.db]?.[tipo] ?? null;
        h.addRow({ ...base, atributo: a.etiqueta, tipo, valor, respondido: valor !== null });
      }
    }
    if (formato !== 'descriptivo') {
      h.addRow({ ...base, atributo: 'Impresión global', tipo: 'calidad', valor: f.impresionGlobal, respondido: f.impresionGlobal !== null });
      h.addRow({ ...base, atributo: 'Tazas no uniformes', tipo: 'conteo', valor: f.u, respondido: true });
      h.addRow({ ...base, atributo: 'Tazas defectuosas', tipo: 'conteo', valor: f.d, respondido: true });
      h.addRow({ ...base, atributo: 'Puntaje final', tipo: 'puntaje', valor: f.puntaje, respondido: f.puntaje !== null });
    }
  }
  estilizar(h);
}

function hojaFichasTecnicas(libro: Workbook, r: SessionResults): void {
  const h = libro.addWorksheet(tr('Fichas técnicas'));
  h.columns = [
    { header: tr('Muestra'), key: 'muestra', width: 9 },
    { header: tr('Registrada por'), key: 'por', width: 18 },
    { header: tr('Sección'), key: 'seccion', width: 18 },
    { header: tr('Campo'), key: 'campo', width: 26 },
    { header: tr('Valor'), key: 'valor', width: 48 }
  ];
  for (const f of r.fichasTecnicas) {
    const base = { muestra: f.numeroMuestra, por: f.registradaPor ?? '' };
    for (const s of f.secciones) for (const c of s.campos) h.addRow({ ...base, seccion: tr(s.titulo), campo: tr(c.etiqueta), valor: c.valor === '—' ? '' : tr(c.valor) });
    h.addRow({ ...base, seccion: tr('Certificaciones'), campo: '', valor: f.certificaciones.map(c => tr(c)).join(', ') });
    if (f.notas) h.addRow({ ...base, seccion: tr('Notas'), campo: '', valor: f.notas });
  }
  estilizar(h);
}

/* ── Estilo común: cabecera oscura, fila congelada y autofiltro ─────────── */

function estilizar(h: Worksheet, filtro = true): void {
  const cabecera = h.getRow(1);
  cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CABECERA } };
  cabecera.alignment = { vertical: 'middle', wrapText: true };
  cabecera.height = 30;
  h.views = [{ state: 'frozen', ySplit: 1 }];
  if (filtro && h.columnCount > 0) h.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: h.columnCount } };
}
