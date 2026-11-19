/**
 * Reglas de contraseña segura de PacamaraQS.
 *
 * Son las mismas que se configuran en Supabase → Auth → Password security
 * (longitud mínima 10; minúsculas, mayúsculas, números y símbolos), así el
 * usuario ve en pantalla exactamente lo que el servidor va a exigir.
 * Los símbolos son los que reconoce Supabase.
 */

export const LONGITUD_MINIMA_CONTRASENA = 10;

export type ClaveRequisito = 'longitud' | 'mayuscula' | 'minuscula' | 'numero' | 'simbolo' | 'sin_datos';

export interface RequisitoContrasena {
  clave: ClaveRequisito;
  cumple: boolean;
}

export interface DatosPersonales {
  nombre?: string | null;
  email?: string | null;
}

const SIMBOLOS = /[!@#$%^&*()_+\-=[\]{};':"|<>?,./`~\\]/;

/** Palabras del nombre y usuario del correo (4+ letras) que no deben aparecer en la contraseña. */
function datosProhibidos({ nombre, email }: DatosPersonales): string[] {
  const usuarioCorreo = (email ?? '').split('@')[0] ?? '';
  return [...(nombre ?? '').split(/\s+/), usuarioCorreo]
    .map(parte => parte.trim().toLowerCase())
    .filter(parte => parte.length >= 4);
}

export function evaluarContrasena(contrasena: string, datos: DatosPersonales = {}): RequisitoContrasena[] {
  const valor = contrasena ?? '';
  const minusculas = valor.toLowerCase();
  const contieneDatos = datosProhibidos(datos).some(dato => minusculas.includes(dato));
  return [
    { clave: 'longitud', cumple: valor.length >= LONGITUD_MINIMA_CONTRASENA },
    { clave: 'mayuscula', cumple: /[A-Z]/.test(valor) },
    { clave: 'minuscula', cumple: /[a-z]/.test(valor) },
    { clave: 'numero', cumple: /\d/.test(valor) },
    { clave: 'simbolo', cumple: SIMBOLOS.test(valor) },
    { clave: 'sin_datos', cumple: valor.length > 0 && !contieneDatos }
  ];
}

export function contrasenaEsSegura(contrasena: string, datos: DatosPersonales = {}): boolean {
  return evaluarContrasena(contrasena, datos).every(requisito => requisito.cumple);
}

/** 0 a 4, para el medidor de fortaleza. */
export function nivelContrasena(contrasena: string, datos: DatosPersonales = {}): number {
  if (!contrasena) return 0;
  const cumplidos = evaluarContrasena(contrasena, datos).filter(r => r.cumple).length;
  if (cumplidos === 6) return contrasena.length >= 14 ? 4 : 3;
  if (cumplidos >= 4) return 2;
  return 1;
}

/** Primer requisito que falta (para el mensaje de error al guardar), o null si cumple todo. */
export function primerRequisitoFaltante(contrasena: string, datos: DatosPersonales = {}): ClaveRequisito | null {
  return evaluarContrasena(contrasena, datos).find(requisito => !requisito.cumple)?.clave ?? null;
}
