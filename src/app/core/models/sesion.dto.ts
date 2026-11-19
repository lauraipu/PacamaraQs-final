/**
 * Forma de las filas de `sesiones` y `participantes` en Supabase (snake_case).
 * Solo la usan el servicio de sesión y su mapper. Se moverá a
 * features/sesiones/data-access/ en el paso 7.
 */
export interface SesionDto {
  id?: string | null;
  nombre: string;
  formato_cva: string;
  numero_muestras: number;
  catadores_objetivo: number;
  organizador_participa: boolean;
  codigo_sesion: string;
  organizador_id: string;
  estado?: string | null;
  notas?: string | null;
  creado_en?: string | null;
}

export interface ParticipanteDto {
  id?: string | null;
  sesion_id: string;
  usuario_id?: string | null;
  nombre: string;
  es_organizador?: boolean | null;
  listo?: boolean | null;
  unido_en?: string | null;
}
