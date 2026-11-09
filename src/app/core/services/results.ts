import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import {
  CupperResultSummary,
  PromedioAtributo,
  SampleConsolidatedResult,
  SessionResults,
  ValorAtributo,
  VotoHedonico
} from '../models/session-results.model';
import { sesionDtoToDomain } from '../mappers/sesion.mapper';
import { construirFichasTecnicas, ExtrinsecaRegistradaDto, FichaExtrinsecaDto } from '../mappers/ficha-tecnica.mapper';

/** Forma real (snake_case) que devuelve la RPC get_resumen_panel. */
interface ResumenPanelDto {
  por_muestra: {
    numero_muestra: number;
    nivel_tueste: string | null;
    evaluaciones_recibidas: number;
    evaluaciones_esperadas: number;
    recortado: boolean;
    cerrada_forzada: boolean;
    puntaje_promedio_panel: number | null;
    puntaje_promedio_simple: number | null;
    puntaje_min: number | null;
    puntaje_max: number | null;
    desviacion_estandar: number | null;
  }[];
  por_catador: {
    cupper_id: string;
    nombre: string;
    es_organizador: boolean;
    muestras_evaluadas: number;
    muestras_asignadas: number;
    estado: 'pendiente' | 'enviado';
    submitted_at: string | null;
    puntaje_promedio: number | null;
    desviacion_respecto_panel: number | null;
    puntajes_por_muestra: {
      numero_muestra: number;
      puntaje: number | null;
      tazas_no_uniformes: number;
      tazas_defectuosas: number;
      impresion_global?: number | null;
      atributos?: Record<string, { intensidad: number | null; calidad: number | null }> | null;
      formulario?: Record<string, unknown> | null;
    }[];
  }[];
  /* Claves agregadas en la migración 20261104150000_resultados_por_formato. */
  por_atributo?: {
    numero_muestra: number;
    atributo: string;
    respuestas: number;
    intensidad_promedio: number | null;
    calidad_promedio: number | null;
  }[];
  votos_hedonicos?: { numero_muestra: number; valor: number; votos: number }[];
  fichas_extrinsecas?: FichaExtrinsecaDto[];
  extrinseca_registrada?: ExtrinsecaRegistradaDto[];
}

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

@Injectable({ providedIn: 'root' })
export class ResultsService {
  private readonly supabase = inject(SupabaseService);

  async obtenerResultadosSesion(sesionId: string): Promise<SessionResults | null> {
    const { data: sesionData, error: sesionError } = await this.supabase.client
      .from('sesiones')
      .select('*')
      .eq('id', sesionId)
      .maybeSingle();

    if (sesionError) throw sesionError;
    if (!sesionData) return null;
    const sesion = sesionDtoToDomain(sesionData);

    const { data, error } = await this.supabase.client
      .rpc('get_resumen_panel', { p_sesion_id: sesionId });

    if (error) throw error;
    if (!data) return null;

    const resumen = data as ResumenPanelDto;
    const muestras = (resumen.por_muestra ?? []).map(m => this.mapearMuestra(m));
    const catadores = (resumen.por_catador ?? []).map(c => this.mapearCatador(c));

    return {
      sesionId,
      nombreSesion: sesion.nombre,
      formatoCva: sesion.formato,
      fechaCierre: new Date().toISOString(),
      esPersonal: (sesionData as { es_personal?: boolean }).es_personal === true,
      codigoSesion: sesion.codigoAcceso ?? undefined,
      creadaEn: sesion.creadaEn ?? undefined,
      totalMuestras: sesion.numeroMuestras,
      totalCatadores: catadores.length,
      muestras,
      catadores,
      atributosPorMuestra: (resumen.por_atributo ?? []).map(a => this.mapearPromedioAtributo(a)),
      votosHedonicos: (resumen.votos_hedonicos ?? []).map(v => this.mapearVoto(v)),
      fichasTecnicas: construirFichasTecnicas(resumen.fichas_extrinsecas ?? [], resumen.extrinseca_registrada ?? [])
    };
  }

  /**
   * Antes el objeto snake_case de la RPC se asignaba directo a un modelo
   * camelCase: todas las tarjetas mostraban `undefined` y el `@for` hacía
   * track por `muestra.numeroMuestra` (undefined) → claves duplicadas.
   */
  private mapearMuestra(m: ResumenPanelDto['por_muestra'][number]): SampleConsolidatedResult {
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

  private mapearCatador(c: ResumenPanelDto['por_catador'][number]): CupperResultSummary {
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
        atributos: this.mapearAtributos(p.atributos),
        formulario: p.formulario && typeof p.formulario === 'object' && !Array.isArray(p.formulario) ? p.formulario : null
      }))
    };
  }

  private mapearAtributos(
    atributos: Record<string, { intensidad: number | null; calidad: number | null }> | null | undefined
  ): Partial<Record<string, ValorAtributo>> {
    const resultado: Partial<Record<string, ValorAtributo>> = {};
    for (const [clave, valor] of Object.entries(atributos ?? {})) {
      resultado[clave] = { intensidad: numONulo(valor?.intensidad), calidad: numONulo(valor?.calidad) };
    }
    return resultado;
  }

  private mapearPromedioAtributo(a: NonNullable<ResumenPanelDto['por_atributo']>[number]): PromedioAtributo {
    return {
      numeroMuestra: num(a.numero_muestra),
      atributo: a.atributo,
      respuestas: num(a.respuestas),
      intensidadPromedio: numONulo(a.intensidad_promedio),
      calidadPromedio: numONulo(a.calidad_promedio)
    };
  }

  private mapearVoto(v: NonNullable<ResumenPanelDto['votos_hedonicos']>[number]): VotoHedonico {
    return { numeroMuestra: num(v.numero_muestra), valor: num(v.valor), votos: num(v.votos) };
  }
}
