import { codigoDeError, esSinConexion, estadoHttp, mensajeDeError } from './errores';

/**
 * Traduce cualquier error (Supabase, PostgREST, Auth o red) a una clave de
 * mensaje claro para el usuario. Los detalles técnicos quedan en la consola.
 */
export function claveDeError(error: unknown): string {
  if (esSinConexion(error)) return 'errores.sin_conexion';

  const codigo = codigoDeError(error);
  const estado = estadoHttp(error);
  const texto = mensajeDeError(error, '').toLowerCase();

  if (codigo === 'invalid_credentials') return 'errores.credenciales';
  // Límites del laboratorio (SQLSTATE propios de la migración limites_laboratorio).
  if (codigo === 'PA001') return 'errores.app_en_pausa';
  if (codigo === 'PA002') return 'errores.max_sesiones';
  if (codigo === 'PA003') return 'errores.limite_bd';
  if (codigo === 'PA004') return 'errores.registros_cerrados';
  if (codigo === '22023' || codigo === '23514') return 'errores.dato_invalido';
  if (codigo === 'session_not_found' || codigo === 'refresh_token_not_found' || codigo === 'bad_jwt'
    || codigo === 'PGRST301' || texto.includes('jwt expired')) return 'errores.sesion_expirada';
  if (codigo === '42501' || estado === 403) return 'errores.sin_permiso';
  if (codigo === 'P0002' || codigo === 'PGRST116' || estado === 404) return 'errores.no_existe';
  if (codigo === '23505') return 'errores.duplicado';
  if (estado === 429 || codigo.includes('rate_limit')) return 'errores.limite';
  if (estado >= 500) return 'errores.servidor';
  return 'errores.inesperado';
}
