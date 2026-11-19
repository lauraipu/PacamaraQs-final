/** Columnas de public.usuarios que lee Configuración (forma exacta de Supabase). */
export interface PerfilDto {
  nombre: string | null;
  idioma: string | null;
  preferencias: Record<string, unknown> | null;
}
