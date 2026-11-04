import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import {
  CupperResultSummary,
  SampleConsolidatedResult,
  SessionResults
} from '../models/session-results.model';
import { sesionDtoToDomain } from '../mappers/sesion.mapper';

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
    }[];
  }[];
}

const num = (valor: unknown): number => {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : 0;
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
      totalMuestras: sesion.numeroMuestras,
      totalCatadores: catadores.length,
      muestras,
      catadores
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
        tazasDefectuosas: num(p.tazas_defectuosas)
      }))
    };
  }
}
