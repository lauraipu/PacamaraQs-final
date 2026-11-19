/**
 * DTOs de los límites del laboratorio (tabla `configuracion_app`): forma EXACTA
 * del JSON que devuelven `estado_app()` y `admin_obtener_configuracion()`.
 * No se usan en la vista: los repositorios los convierten a modelos.
 */

/** `estado_app()`: lo puede leer cualquier usuario autenticado. */
export interface EstadoAppDto {
  en_pausa: boolean;
  mensaje: string | null;
  pausar_desde: string | null;
  registros_abiertos: boolean;
}

/** Fila de `configuracion_app` (sin el id). */
export interface ConfiguracionAppDto {
  pausada: boolean;
  pausar_desde: string | null;
  mensaje_pausa: string;
  registros_abiertos: boolean;
  max_sesiones_abiertas: number;
  max_escaneos_hora: number;
  limite_bd_mb: number;
  actualizado_en: string | null;
  actualizado_por: string | null;
}

/** Medidores de uso que calcula el servidor. */
export interface UsoAppDto {
  en_pausa: boolean;
  tamano_bd_bytes: number;
  sesiones_abiertas: number;
  escaneos_24h: number;
  usuarios: number;
  evaluaciones: number;
}

/** `admin_obtener_configuracion()`. */
export interface AdminConfiguracionDto {
  configuracion: ConfiguracionAppDto;
  uso: UsoAppDto;
}
