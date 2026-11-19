/**
 * Reglas de negocio de la ficha técnica de una muestra (formato extrínseco).
 * TypeScript puro: no formatea ni traduce; eso lo hace la capa de presentación.
 */

export type Registro = Readonly<Record<string, unknown>>;

/** Las dos fuentes de una muestra, ya emparejadas por número de muestra. */
export interface FuenteFicha {
  numeroMuestra: number;
  /** Quién llenó el formulario extrínseco (null si solo hay fila en la tabla). */
  registradaPor: string | null;
  /** Fecha del formulario (null si no hay formulario o no tiene fecha). */
  registradoEnFicha: string | null;
  /** Formulario que guarda la app en evaluaciones.notas. */
  formulario: Registro;
  /** Fila estructurada de evaluacion_extrinseca. */
  tabla: Registro;
  /** Nombres de certificaciones asociadas a la fila de la tabla. */
  certificacionesTabla: readonly unknown[];
}

/** Certificaciones que el formulario guarda como casillas (clave → nombre). */
export const CERTIFICACIONES_FORMULARIO: Readonly<Record<string, string>> = {
  c4: '4C',
  fairTrade: 'Fair Trade',
  organic: 'Orgánico',
  rainforest: 'Rainforest Alliance'
};

/** Un dato vacío no cuenta: null, texto en blanco, número no finito u otro tipo. */
export function esDatoVacio(valor: unknown): boolean {
  if (typeof valor === 'boolean') return false;
  if (typeof valor === 'number') return !Number.isFinite(valor);
  if (typeof valor === 'string') return valor.trim() === '';
  return true;
}

/** REGLA: la tabla estructurada gana campo a campo; el formulario rellena los vacíos. */
export function datoPreferente(deTabla: unknown, deFormulario: unknown): unknown {
  if (!esDatoVacio(deTabla)) return deTabla;
  if (!esDatoVacio(deFormulario)) return deFormulario;
  return undefined;
}

/** REGLA: el precio en finca de la tabla gana; si no es número, el del formulario. */
export function precioPreferente(deTabla: unknown, deFormulario: unknown): number | null {
  if (typeof deTabla === 'number') return deTabla;
  if (typeof deFormulario === 'number') return deFormulario;
  return null;
}

/**
 * REGLA: certificaciones = las de la tabla + las casillas marcadas en el
 * formulario + "otra", sin repetir y en orden alfabético.
 */
export function unirCertificaciones(deTabla: readonly string[], marcadas: Registro, otra: string): string[] {
  const todas = new Set<string>(deTabla.filter(Boolean));
  for (const [clave, nombre] of Object.entries(CERTIFICACIONES_FORMULARIO)) {
    if (marcadas[clave] === true) todas.add(nombre);
  }
  if (otra) todas.add(otra);
  return [...todas].sort((a, b) => a.localeCompare(b, 'es'));
}
