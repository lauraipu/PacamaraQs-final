import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.client';
import { EstadoAppDto } from '@core/dto/configuracion.dto';
import { aEstadoApp } from './estado-app.mapper';
import { EstadoApp } from './estado-app.model';

/**
 * Lee `estado_app()` (pausa del laboratorio). Es informativo: si falla, la app
 * sigue igual, porque el servidor ya bloquea las acciones con la plataforma en pausa.
 */
@Injectable({ providedIn: 'root' })
export class EstadoAppRepository {
  private readonly supabase = inject(SupabaseService);

  async obtener(): Promise<EstadoApp | null> {
    try {
      const { data, error } = await this.supabase.client.rpc('estado_app');
      if (error) throw error;
      return aEstadoApp(data as EstadoAppDto | null);
    } catch (error) {
      console.warn('[EstadoApp] no se pudo leer el estado de la plataforma', error);
      return null;
    }
  }
}
