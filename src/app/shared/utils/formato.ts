/** Formateo visual (fechas, tamaños, iniciales) según el idioma activo. Sin lógica de negocio. */
const LOCALES: Record<string, string> = { es: 'es-CO', en: 'en-US', it: 'it-IT', zh: 'zh-CN' };

export function localeDe(idioma: string): string {
  return LOCALES[idioma] ?? 'es-CO';
}

export function formatearFecha(fecha: Date | null, idioma: string, conHora = false): string {
  if (!fecha) return '';
  return new Intl.DateTimeFormat(localeDe(idioma), conHora
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha);
}

export function formatearDiaCorto(fecha: Date, idioma: string): string {
  return new Intl.DateTimeFormat(localeDe(idioma), { day: 'numeric', month: 'short' }).format(fecha);
}

export function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Precio con su moneda: 25000, 'COP' → "$ 25.000 COP". */
export function formatearPrecio(valor: number, moneda = 'COP'): string {
  try {
    const n = new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: moneda, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(valor);
    return `${n.replace(/\u00a0/g, ' ')} ${moneda}`;
  } catch {
    return `${valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${moneda}`;
  }
}
