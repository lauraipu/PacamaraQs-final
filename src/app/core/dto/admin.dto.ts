/**
 * DTOs del panel de administrador: forma EXACTA del JSON que devuelven las
 * funciones RPC `admin_*` de Supabase (snake_case, fechas como texto ISO).
 * No se usan en la vista: el mapper los convierte a los modelos de dominio.
 */

export interface PaginaDto<T> {
  total: number;
  filas: T[];
}

export interface ActividadDiaDto {
  dia: string;
  sesiones: number;
  evaluaciones: number;
}

export interface AdminResumenDto {
  usuarios: number;
  administradores: number;
  usuarios_nuevos_7d: number;
  activos_7d: number;
  sesiones: number;
  sesiones_por_estado: Record<string, number>;
  sesiones_por_formato: Record<string, number>;
  evaluaciones: number;
  evaluaciones_7d: number;
  escaneos_24h: number;
  escaneos_7d: number;
  tamano_bd_bytes: number;
  actividad_14d: ActividadDiaDto[];
}

export interface AdminUsuarioDto {
  id: string;
  email: string;
  nombre: string | null;
  rol_global: string;
  creado_en: string;
  idioma: string | null;
  activo: boolean;
  desactivado_en: string | null;
  ultimo_acceso: string | null;
  tiene_dos_pasos: boolean;
  sesiones_organizadas: number;
  evaluaciones: number;
}

export type ResultadoEliminarUsuarioDto = 'eliminado' | 'desactivado';

export interface AdminSesionDto {
  id: string;
  nombre: string;
  formato_cva: string;
  estado: string;
  codigo_sesion: string | null;
  es_personal: boolean;
  numero_muestras: number;
  catadores_objetivo: number;
  creado_en: string;
  organizador_nombre: string | null;
  organizador_email: string | null;
  catadores: number;
  listos: number;
  evaluaciones: number;
}

export interface AdminEventoDto {
  id: number;
  tabla: string;
  operacion: string;
  registro_id: string | null;
  sesion_id: string | null;
  sesion_nombre: string | null;
  actor_nombre: string | null;
  actor_email: string | null;
  datos: Record<string, unknown> | null;
  creado_en: string;
}
