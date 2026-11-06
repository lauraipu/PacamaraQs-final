import { FichaTecnica, FichaTecnicaSeccion } from '../models/session-results.model';
import { divisionDe, etiquetaProceso, formatearPrecio } from '../cva/origenes';

/** Ficha extrínseca serializada en evaluaciones.notas (formulario de ExtrinsicFormPage). */
export interface FichaExtrinsecaDto {
  numero_muestra: number;
  nombre: string | null;
  registrado_en: string | null;
  formulario: Record<string, unknown> | null;
}

/** Fila de evaluacion_extrinseca (sin ids) + nombres de certificaciones. */
export interface ExtrinsecaRegistradaDto {
  numero_muestra: number;
  datos: Record<string, unknown> | null;
  certificaciones: string[] | null;
}

type Registro = Record<string, unknown>;

const SIN_DATO = '—';

const CERTIFICACIONES_FORMULARIO: Readonly<Record<string, string>> = {
  c4: '4C',
  fairTrade: 'Fair Trade',
  organic: 'Orgánico',
  rainforest: 'Rainforest Alliance'
};

const comoRegistro = (valor: unknown): Registro =>
  valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Registro) : {};

/** Texto limpio para mostrar; '' si el valor está vacío. */
export function textoDeCampo(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  if (typeof valor === 'string') return valor.trim();
  return '';
}

/** 25000 → "$ 25.000 COP". */
export function formatearCop(valor: number): string {
  return formatearPrecio(valor, 'COP');
}

/**
 * Une las dos fuentes posibles de la ficha técnica de una muestra:
 *  1. La tabla estructurada `evaluacion_extrinseca` (tiene precio, importador…).
 *  2. El formulario extrínseco que la app guarda hoy en `evaluaciones.notas`.
 * La tabla tiene prioridad campo a campo; el formulario rellena los vacíos.
 */
export function construirFichasTecnicas(
  fichas: readonly FichaExtrinsecaDto[],
  registradas: readonly ExtrinsecaRegistradaDto[]
): FichaTecnica[] {
  const pendientes = [...registradas];
  const tomarRegistro = (numeroMuestra: number): ExtrinsecaRegistradaDto | null => {
    const indice = pendientes.findIndex(r => Number(r.numero_muestra) === numeroMuestra);
    return indice >= 0 ? pendientes.splice(indice, 1)[0] : null;
  };

  const resultado = fichas.map(ficha => {
    const numeroMuestra = Number(ficha.numero_muestra);
    return construirFicha(numeroMuestra, ficha, tomarRegistro(numeroMuestra));
  });
  for (const registro of pendientes) {
    resultado.push(construirFicha(Number(registro.numero_muestra), null, registro));
  }
  return resultado.sort((a, b) => a.numeroMuestra - b.numeroMuestra);
}

function construirFicha(
  numeroMuestra: number,
  ficha: FichaExtrinsecaDto | null,
  registro: ExtrinsecaRegistradaDto | null
): FichaTecnica {
  const formulario = comoRegistro(ficha?.formulario);
  const cultivo = comoRegistro(formulario['farming']);
  const proceso = comoRegistro(formulario['processing']);
  const comercio = comoRegistro(formulario['trading']);
  const certForm = comoRegistro(formulario['certifications']);
  const tabla = comoRegistro(registro?.datos);

  const valor = (claveTabla: string | null, valorFormulario?: unknown): string =>
    (claveTabla ? textoDeCampo(tabla[claveTabla]) : '') || textoDeCampo(valorFormulario) || SIN_DATO;

  const precioNumero = typeof tabla['precio_finca'] === 'number' ? tabla['precio_finca']
    : typeof comercio['farmPrice'] === 'number' ? comercio['farmPrice'] : null;
  const moneda = textoDeCampo(comercio['currency']) || 'COP';
  const precio = precioNumero === null ? '' : formatearPrecio(precioNumero, moneda);
  const pais = valor('pais', cultivo['country']);
  const tipoProceso = valor('tipo_proceso', proceso['processType']);
  const loteKg = typeof comercio['lotSizeKg'] === 'number' ? `${comercio['lotSizeKg'].toLocaleString('es-CO')} kg` : '';
  const secciones: FichaTecnicaSeccion[] = [
    {
      titulo: 'Cultivo',
      campos: [
        { etiqueta: 'País', valor: pais },
        { etiqueta: divisionDe(pais), valor: valor('region', cultivo['region']) },
        { etiqueta: 'Finca / Cooperativa', valor: valor('finca_o_coop', cultivo['farmName']) },
        { etiqueta: 'Productores', valor: valor('productores', cultivo['producers']) },
        { etiqueta: 'Especie', valor: valor('especie', cultivo['species']) },
        { etiqueta: 'Variedad', valor: valor('variedad', cultivo['variety']) },
        { etiqueta: 'Fecha de cosecha', valor: valor('fecha_cosecha', cultivo['harvestDate']) },
        { etiqueta: 'Otros (cultivo)', valor: valor('otro_cultivo', cultivo['other']) }
      ]
    },
    {
      titulo: 'Procesamiento',
      campos: [
        { etiqueta: 'Procesador', valor: valor('nombre_procesador', proceso['processorName']) },
        { etiqueta: 'Beneficio húmedo', valor: valor('beneficio_humedo', proceso['wetMill']) },
        { etiqueta: 'Beneficio seco', valor: valor('beneficio_seco', proceso['dryMill']) },
        { etiqueta: 'Tipo de proceso', valor: tipoProceso === SIN_DATO ? SIN_DATO : etiquetaProceso(tipoProceso) },
        { etiqueta: 'Descafeinado', valor: valor('descafeinado', proceso['decaf']) },
        { etiqueta: 'Descripción del proceso', valor: valor('descripcion_proceso', proceso['description']) },
        { etiqueta: 'Otros (proceso)', valor: valor('otro_procesamiento', proceso['other']) }
      ]
    },
    {
      titulo: 'Comercio',
      campos: [
        { etiqueta: 'Grado', valor: valor('grado', comercio['grade']) },
        { etiqueta: 'Número ICO', valor: valor('numero_ico', comercio['icoNumber']) },
        { etiqueta: 'Importador', valor: valor('importador', comercio['importer']) },
        { etiqueta: 'Exportador', valor: valor('exportador', comercio['exporter']) },
        { etiqueta: 'Precio en finca', valor: precio || SIN_DATO },
        { etiqueta: 'Tamaño de lote', valor: valor('tamano_lote', loteKg) },
        { etiqueta: 'Otros (comercial)', valor: valor('otro_comercial', comercio['other']) }
      ]
    }
  ];

  const otros = [
    { etiqueta: 'Premios', valor: textoDeCampo(tabla['premios']) },
    { etiqueta: 'Otra información', valor: textoDeCampo(tabla['otra_info']) }
  ].filter(c => c.valor !== '');
  if (otros.length > 0) secciones.push({ titulo: 'Información adicional', campos: otros });

  const certificaciones = new Set<string>(
    (registro?.certificaciones ?? []).map(textoDeCampo).filter(Boolean)
  );
  for (const [clave, etiqueta] of Object.entries(CERTIFICACIONES_FORMULARIO)) {
    if (certForm[clave] === true) certificaciones.add(etiqueta);
  }
  const otraCert = textoDeCampo(certForm['other']);
  if (otraCert) certificaciones.add(otraCert);

  return {
    numeroMuestra,
    registradaPor: ficha?.nombre ?? null,
    registradaEn: ficha?.registrado_en ?? (textoDeCampo(tabla['creado_en']) || null),
    secciones,
    certificaciones: [...certificaciones].sort((a, b) => a.localeCompare(b, 'es')),
    notas: textoDeCampo(formulario['notes'])
  };
}
