import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

export interface NuevaEvaluacion {
  sesion_id: string;
  catador_id: string;
  numero_muestra: number;
  impresion_global: number | null;
  tazas_no_uniformes: number;
  tazas_defectuosas: number;
  puntaje_final: number | null;
  notas: string | null;
}

export interface EvaluacionAtributo {
  atributo: string;
  intensidad?: number;
  calidad?: number;
}

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private readonly supabase = inject(SupabaseService);

  async crearEvaluacion(data: NuevaEvaluacion): Promise<string> {
    const { data: evalData, error: evalError } = await this.supabase.client
      .from('evaluaciones')
      .upsert({
        sesion_id: data.sesion_id,
        catador_id: data.catador_id,
        numero_muestra: data.numero_muestra,
        impresion_global: data.impresion_global,
        tazas_no_uniformes: data.tazas_no_uniformes,
        tazas_defectuosas: data.tazas_defectuosas,
        puntaje_final: data.puntaje_final,
        notas: data.notas
      }, { onConflict: 'sesion_id,catador_id,numero_muestra' })
      .select('id')
      .single();

    if (evalError) throw evalError;
    if (!evalData?.id) throw new Error('Supabase no devolvió el ID de la evaluación guardada.');
    return evalData.id;
  }

  async guardarAtributos(evaluacionId: string, atributos: EvaluacionAtributo[]): Promise<void> {
    if (!evaluacionId.trim()) throw new Error('El ID de la evaluación es obligatorio.');
    if (atributos.length === 0) return;

    const filas = atributos.map(atributo => ({
      evaluacion_id: evaluacionId,
      atributo: atributo.atributo,
      ...(atributo.intensidad !== undefined ? { intensidad: atributo.intensidad } : {}),
      ...(atributo.calidad !== undefined ? { calidad: atributo.calidad } : {})
    }));
    const { error } = await this.supabase.client
      .from('evaluacion_atributos')
      .upsert(filas, { onConflict: 'evaluacion_id,atributo' });

    if (error) throw error;
  }

  async guardarEvaluacion(data: NuevaEvaluacion & { atributos: EvaluacionAtributo[] }): Promise<void> {
    const evaluacionId = await this.crearEvaluacion(data);
    await this.guardarAtributos(evaluacionId, data.atributos);
  }
}

export { EvaluationService as Evaluation };