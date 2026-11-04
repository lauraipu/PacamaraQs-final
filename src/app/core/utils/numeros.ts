/**
 * Números escritos con formato colombiano (punto de miles, coma decimal).
 * Se usa en el formulario extrínseco y al sanear lo que lee el escáner.
 */

/** Caracteres permitidos mientras se escribe un número (dígitos, separadores, $ y espacios). */
export const CARACTERES_NUMERICOS = /[0-9.,$\s]/;

/**
 * "25.000" → 25000 · "25.000,50" → 25000.5 · "12,5" → 12.5 · "$ 1500" → 1500.
 * Devuelve null si hay letras u otros símbolos.
 */
export function parsearNumeroEs(texto: string): number | null {
  const limpio = texto.replace(/[\s$]|COP/gi, '');
  if (!limpio || !/^\d[\d.,]*$/.test(limpio)) return null;
  let normal = limpio;
  if (limpio.includes(',')) normal = limpio.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) normal = limpio.replace(/\./g, '');
  if ((normal.match(/\./g) ?? []).length > 1) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** 25000 → "25.000" · 12.5 → "12,5". */
export function formatearNumeroEs(valor: number | null | undefined, decimales = 2): string {
  return typeof valor === 'number' && Number.isFinite(valor)
    ? valor.toLocaleString('es-CO', { maximumFractionDigits: decimales })
    : '';
}
