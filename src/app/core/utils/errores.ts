/**
 * Utilidades para clasificar errores de Supabase (PostgREST / Auth / red).
 * PostgrestError no siempre es `instanceof Error`, por eso se lee por forma.
 */

interface ErrorConCodigo {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  name?: unknown;
}

const PATRONES_RED = [
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
  'fetch failed',
  'the internet connection appears to be offline',
  'timeout',
  'timed out',
  'econnreset',
  'socket hang up'
];

/** Códigos de Postgres/PostgREST que nunca se resuelven reintentando. */
const CODIGOS_PERMANENTES = new Set([
  '42501', // RLS / privilegios: la muestra está cerrada o ya no eres participante
  '23514', // CHECK violado
  '23502', // NOT NULL violado
  '23503', // FK violada
  '22023', // parámetro inválido (RAISE de las RPC)
  '22P02', // texto inválido para el tipo
  'P0002', // no encontrado (RAISE de las RPC)
  'PGRST116',
  'PGRST204'
]);

function comoRegistro(error: unknown): ErrorConCodigo {
  return typeof error === 'object' && error !== null ? (error as ErrorConCodigo) : {};
}

export function mensajeDeError(error: unknown, alternativo = 'Ocurrió un error inesperado.'): string {
  if (typeof error === 'string' && error.trim()) return error;
  const mensaje = comoRegistro(error).message;
  return typeof mensaje === 'string' && mensaje.trim() ? mensaje : alternativo;
}

export function codigoDeError(error: unknown): string {
  const codigo = comoRegistro(error).code;
  return typeof codigo === 'string' ? codigo : '';
}

/** true si el fallo es de conectividad / servidor temporalmente caído. */
export function esErrorDeRed(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;

  const registro = comoRegistro(error);
  const status = typeof registro.status === 'number' ? registro.status : 0;
  if (status === 408 || status === 429 || status >= 500) return true;

  if (registro.name === 'AbortError') return true;

  const texto = mensajeDeError(error, '').toLowerCase();
  return PATRONES_RED.some(patron => texto.includes(patron));
}

/** true si reintentar no cambiará el resultado (permisos, validación). */
export function esErrorPermanente(error: unknown): boolean {
  if (esErrorDeRed(error)) return false;
  const codigo = codigoDeError(error);
  if (CODIGOS_PERMANENTES.has(codigo)) return true;
  const status = comoRegistro(error).status;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
}
