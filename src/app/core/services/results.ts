import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import { SessionResults } from '../models/session-results.model';
import { sesionDtoToDomain } from '../mappers/sesion.mapper';

@Injectable({ providedIn: 'root' })
export class ResultsService {
  private readonly supabase = inject(SupabaseService);

  async obtenerResultadosSesion(sesionId: string): Promise<SessionResults | null> {
    // 1. Consultamos los datos de la sesión (para tener el nombre y formato)
    const { data: sesionData, error: sesionError } = await this.supabase.client
      .from('sesiones')
      .select('*')
      .eq('id', sesionId)
      .single();
    
    if (sesionError) throw sesionError;
    if (!sesionData) return null;
    const sesion = sesionDtoToDomain(sesionData);

    // 2. Consultamos la RPC (Consolidado por muestra y catador)
    const { data, error } = await this.supabase.client
      .rpc('get_resumen_panel', { p_sesion_id: sesionId });

    if (error) throw error;
    if (!data) return null;

    // 3. Armamos la respuesta final
    return {
      sesionId: sesionId,
      nombreSesion: sesion.nombre,
      formatoCva: sesion.formato,
      fechaCierre: new Date().toISOString(),
      totalMuestras: sesion.numeroMuestras,
      totalCatadores: sesion.catadoresObjetivo,
      muestras: data.por_muestra || [],
      catadores: data.por_catador || []
    };
  }
}