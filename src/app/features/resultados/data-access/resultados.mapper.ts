import { Sesion } from '@domain/sesion/sesion.model';
import { FuenteFicha, Registro } from '@domain/ficha-tecnica/ficha-tecnica';
import {
  CupperResultSummary, PromedioAtributo, SampleConsolidatedResult, SessionResults, ValorAtributo, VotoHedonico
} from '../models/resultados.model';
import { ExtrinsecaRegistradaDto, FichaExtrinsecaDto, ResumenPanelDto } from '@core/dto/resultados.dto';

/** Traductores puros DTO → modelo. Sin reglas de negocio, sin formateo visual. */

const num = (valor: unknown): number => {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/** Como `num`, pero conserva la ausencia de dato (null ≠ 0 en una escala 0–15). */
const numONulo = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
};

const comoRegistro = (valor: unknown): Registro =>
  valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Registro) : {};

export function aResultadosSesion(
  sesionId: string,
  sesion: Sesion,
  esPersonal: boolean,
  resumen: ResumenPanelDto
): SessionResults {
  const catadores = (resumen.por_catador ?? []).map(aCatador);
  return {
    sesionId,
    nombreSesion: sesion.nombre,
    formatoCva: sesion.formato,
    fechaCierre: new Date().toISOString(),
    esPersonal,
    codigoSesion: sesion.codigoAcceso ?? undefined,
    creadaEn: sesion.creadaEn ?? undefined,
    totalMuestras: sesion.numeroMuestras,
    totalCatadores: catadores.length,
    muestras: (resumen.por_muestra ?? []).map(aMuestra),
    catadores,
    atributosPorMuestra: (resumen.por_atributo ?? []).map(aPromedioAtributo),
    votosHedonicos: (resumen.votos_hedonicos ?? []).map(aVoto),
    fuentesFicha: aFuentesFicha(resumen.fichas_extrinsecas ?? [], resumen.extrinseca_registrada ?? [])
  };
}

/**
 * Empareja el formulario y la fila de la tabla de cada muestra por número.
 * Solo junta los datos: qué fuente gana lo decide domain/ficha-tecnica.
 */
export function aFuentesFicha(
  fichas: readonly FichaExtrinsecaDto[],
  registradas: readonly ExtrinsecaRegistradaDto[]
): FuenteFicha[] {
  const pendientes = [...registradas];
  const tomarRegistro = (numeroMuestra: number): ExtrinsecaRegistradaDto | null => {
    const indice = pendientes.findIndex(r => Number(r.numero_muestra) === numeroMuestra);
    return indice >= 0 ? pendientes.splice(indice, 1)[0] : null;
  };
  const fuente = (numeroMuestra: number, ficha: FichaExtrinsecaDto | null, registro: ExtrinsecaRegistradaDto | null): FuenteFicha => ({
    numeroMuestra,
    registradaPor: ficha?.nombre ?? null,
    registradoEnFicha: ficha?.registrado_en ?? null,
    formulario: comoRegistro(ficha?.formulario),
    tabla: comoRegistro(registro?.datos),
    certificacionesTabla: registro?.certificaciones ?? []
  });

  const resultado = fichas.map(ficha => {
    const numeroMuestra = Number(ficha.numero_muestra);
    return fuente(numeroMuestra, ficha, tomarRegistro(numeroMuestra));
  });
  for (const registro of pendientes) resultado.push(fuente(Number(registro.numero_muestra), null, registro));
  return resultado;
}

/**
 * Antes el objeto snake_case de la RPC se asignaba directo a un modelo
 * camelCase: todas las tarjetas mostraban `undefined` y el `@for` hacía
 * track por `muestra.numeroMuestra` (undefined) → claves duplicadas.
 */
function aMuestra(m: ResumenPanelDto['por_muestra'][number]): SampleConsolidatedResult {
  return {
    numeroMuestra: num(m.numero_muestra),
    nivelTueste: m.nivel_tueste,
    puntajePromedioPanel: num(m.puntaje_promedio_panel),
    puntajeMin: num(m.puntaje_min),
    puntajeMax: num(m.puntaje_max),
    desviacionEstandar: num(m.desviacion_estandar),
    evaluacionesRecibidas: num(m.evaluaciones_recibidas),
    evaluacionesEsperadas: num(m.evaluaciones_esperadas),
    recortado: m.recortado === true,
    puntajePromedioSimple: num(m.puntaje_promedio_simple),
    cerradaForzada: m.cerrada_forzada === true
  };
}

function aCatador(c: ResumenPanelDto['por_catador'][number]): CupperResultSummary {
  return {
    cupperId: c.cupper_id,
    nombre: c.nombre,
    esOrganizador: c.es_organizador,
    muestrasEvaluadas: num(c.muestras_evaluadas),
    muestrasAsignadas: num(c.muestras_asignadas),
    estado: c.estado,
    submittedAt: c.submitted_at,
    puntajePromedio: num(c.puntaje_promedio),
    desviacionRespectoPanel: num(c.desviacion_respecto_panel),
    puntajesPorMuestra: (c.puntajes_por_muestra ?? []).map(p => ({
      numeroMuestra: num(p.numero_muestra),
      puntaje: num(p.puntaje),
      defectos: [],
      tazasNoUniformes: num(p.tazas_no_uniformes),
      tazasDefectuosas: num(p.tazas_defectuosas),
      impresionGlobal: numONulo(p.impresion_global),
      atributos: aAtributos(p.atributos),
      formulario: p.formulario && typeof p.formulario === 'object' && !Array.isArray(p.formulario) ? p.formulario : null
    }))
  };
}

function aAtributos(
  atributos: Record<string, { intensidad: number | null; calidad: number | null }> | null | undefined
): Partial<Record<string, ValorAtributo>> {
  const resultado: Partial<Record<string, ValorAtributo>> = {};
  for (const [clave, valor] of Object.entries(atributos ?? {})) {
    resultado[clave] = { intensidad: numONulo(valor?.intensidad), calidad: numONulo(valor?.calidad) };
  }
  return resultado;
}

function aPromedioAtributo(a: NonNullable<ResumenPanelDto['por_atributo']>[number]): PromedioAtributo {
  return {
    numeroMuestra: num(a.numero_muestra),
    atributo: a.atributo,
    respuestas: num(a.respuestas),
    intensidadPromedio: numONulo(a.intensidad_promedio),
    calidadPromedio: numONulo(a.calidad_promedio)
  };
}

function aVoto(v: NonNullable<ResumenPanelDto['votos_hedonicos']>[number]): VotoHedonico {
  return { numeroMuestra: num(v.numero_muestra), valor: num(v.valor), votos: num(v.votos) };
}
