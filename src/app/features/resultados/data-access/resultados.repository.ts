import { inject, Injectable } from '@angular/core';
import { sesionDtoToDomain } from '@core/data-access/sesiones/sesion.mapper';
import { SupabaseService } from '@core/supabase/supabase.client';
import { SessionResults } from '../models/resultados.model';
import { ResumenPanelDto } from '@core/dto/resultados.dto';
import { aResultadosSesion } from './resultados.mapper';

/** Único acceso de la feature resultados a Supabase: consulta y traduce, sin reglas de negocio. */
@Injectable({ providedIn: 'root' })
export class ResultadosRepository {
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

    const [{ data, error }, nombres] = await Promise.all([
      this.supabase.client.rpc('get_resumen_panel', { p_sesion_id: sesionId }),
      this.obtenerNombresMuestras(sesionId)
    ]);

    if (error) throw error;
    if (!data) return null;

    const esPersonal = (sesionData as { es_personal?: boolean }).es_personal === true;
    return { ...aResultadosSesion(sesionId, sesion, esPersonal, data as ResumenPanelDto), nombresMuestras: nombres };
  }

  /** Sin la columna `muestras.nombre` (migración pendiente) devuelve {}. */
  private async obtenerNombresMuestras(sesionId: string): Promise<Record<number, string>> {
    const { data, error } = await this.supabase.client
      .from('muestras')
      .select('numero_muestra, nombre')
      .eq('sesion_id', sesionId);
    if (error) return {};
    const nombres: Record<number, string> = {};
    for (const fila of (data ?? []) as { numero_muestra: number; nombre: string | null }[]) {
      const nombre = fila.nombre?.trim();
      if (nombre) nombres[Number(fila.numero_muestra)] = nombre;
    }
    return nombres;
  }
}
