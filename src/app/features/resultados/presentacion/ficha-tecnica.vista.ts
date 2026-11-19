import {
  datoPreferente, FuenteFicha, precioPreferente, Registro, unirCertificaciones
} from '@domain/ficha-tecnica/ficha-tecnica';
import { divisionDe, etiquetaProceso } from '@domain/origenes/origenes';
import { formatearPrecio } from '@shared/utils/formato';
import { FichaTecnica, FichaTecnicaSeccion } from '../models/resultados.model';

/**
 * Presentación de la ficha técnica: aplica las reglas del dominio y arma las
 * secciones con sus etiquetas (textos fuente que la vista traduce con tr()) y
 * los valores ya formateados para pantalla, PDF, CSV y Excel.
 */

const SIN_DATO = '—';

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
  return formatearPrecio(valor, 'COP').replace(/ /g, ' ');
}

/** Fichas listas para mostrar, ordenadas por número de muestra. */
export function armarFichasTecnicas(fuentes: readonly FuenteFicha[]): FichaTecnica[] {
  return fuentes.map(armarFicha).sort((a, b) => a.numeroMuestra - b.numeroMuestra);
}

function armarFicha(fuente: FuenteFicha): FichaTecnica {
  const formulario = fuente.formulario;
  const cultivo = comoRegistro(formulario['farming']);
  const proceso = comoRegistro(formulario['processing']);
  const comercio = comoRegistro(formulario['trading']);
  const certForm = comoRegistro(formulario['certifications']);
  const tabla = fuente.tabla;

  const valor = (claveTabla: string, valorFormulario?: unknown): string =>
    textoDeCampo(datoPreferente(tabla[claveTabla], valorFormulario)) || SIN_DATO;

  const precioNumero = precioPreferente(tabla['precio_finca'], comercio['farmPrice']);
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

  return {
    numeroMuestra: fuente.numeroMuestra,
    registradaPor: fuente.registradaPor,
    registradaEn: fuente.registradoEnFicha ?? (textoDeCampo(tabla['creado_en']) || null),
    secciones,
    certificaciones: unirCertificaciones(
      fuente.certificacionesTabla.map(textoDeCampo).filter(Boolean),
      certForm,
      textoDeCampo(certForm['other'])
    ),
    notas: textoDeCampo(formulario['notes'])
  };
}
