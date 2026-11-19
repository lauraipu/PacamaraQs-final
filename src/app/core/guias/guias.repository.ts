import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';

/** Persistencia de las guías vistas en usuarios.preferencias.guias. */
@Injectable({ providedIn: 'root' })
export class GuiasRepository {
  private readonly supabase = inject(SupabaseService);

  /** Guías vistas guardadas en la cuenta. Si la consulta falla, lista vacía (no bloquea la pantalla). */
  async vistasEnLaCuenta(usuarioId: string): Promise<string[]> {
    const { data } = await this.supabase.client.from('usuarios').select('preferencias').eq('id', usuarioId).maybeSingle();
    const remotas = (data?.preferencias as { guias?: unknown } | null)?.guias;
    return Array.isArray(remotas) ? remotas.filter((g): g is string => typeof g === 'string') : [];
  }

  /** Marca la guía como vista en la cuenta. Sin esperar ni avisar errores: es una mejora, no un requisito. */
  marcarVista(guia: string): void {
    void this.supabase.client.rpc('marcar_guia_vista', { p_guia: guia }).then(() => undefined, () => undefined);
  }
}
