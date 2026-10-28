import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase';
import { SessionResults } from '../models/session-results.model';

@Injectable({ providedIn: 'root' })
export class ResultsService {
  private readonly supabase = inject(SupabaseService);

  async obtenerResultadosSesion(sesionId: string): Promise<SessionResults | null> {
    // Llamamos a la función SQL que creamos (get_resumen_panel)
    const { data, error } = await this.supabase.client
      .rpc('get_resumen_panel', { p_sesion_id: sesionId });

    if (error) throw error;
    if (!data) return null;

    // Mapeamos la respuesta de la RPC a nuestro modelo de TypeScript
    return {
      sesionId: sesionId,
      nombreSesion: '', // Lo llenaremos luego consultando la sesión
      formatoCva: '',
      fechaCierre: new Date().toISOString(),
      totalMuestras: data.por_muestra?.length || 0,
      totalCatadores: data.por_catador?.length || 0,
      muestras: data.por_muestra || [],
      catadores: data.por_catador || []
    };
  }
}