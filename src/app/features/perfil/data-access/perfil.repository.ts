import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.client';
import { Perfil, Preferencias } from '../models/perfil.model';
import { PerfilDto } from './perfil.dto';
import { aPerfil } from './perfil.mapper';

/**
 * Único acceso de la feature perfil a public.usuarios. Las políticas RLS y el
 * GRANT por columnas limitan cada usuario a su propia fila (nombre, idioma, preferencias).
 */
@Injectable({ providedIn: 'root' })
export class PerfilRepository {
  private readonly supabase = inject(SupabaseService);

  /** null si la fila no existe. Lanza el error de Supabase si la consulta falla. */
  async obtener(usuarioId: string): Promise<Perfil | null> {
    const { data, error } = await this.supabase.client.from('usuarios')
      .select('nombre, idioma, preferencias').eq('id', usuarioId).maybeSingle<PerfilDto>();
    if (error) throw error;
    return data ? aPerfil(data) : null;
  }

  /** Devuelve el nombre ya normalizado por el trigger de la base (mayúscula inicial). */
  async guardarNombre(usuarioId: string, nombre: string): Promise<string> {
    const { data, error } = await this.supabase.client.from('usuarios')
      .update({ nombre: nombre.trim() }).eq('id', usuarioId).select('nombre').single<{ nombre: string }>();
    if (error) throw error;
    return data.nombre;
  }

  async guardarIdioma(usuarioId: string, idioma: string): Promise<void> {
    const { error } = await this.supabase.client.from('usuarios').update({ idioma }).eq('id', usuarioId);
    if (error) throw error;
  }

  /** Combina en el servidor: no borra otras claves (p. ej. las guías vistas). */
  async guardarPreferencias(preferencias: Preferencias): Promise<void> {
    const { error } = await this.supabase.client.rpc('guardar_preferencias', { p_preferencias: preferencias });
    if (error) throw error;
  }
}
