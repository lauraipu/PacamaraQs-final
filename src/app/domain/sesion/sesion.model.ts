export enum EstadoSesion {
  EN_ESPERA = 'esperando',
  INICIADA = 'en_progreso',
  FINALIZADA = 'completada',
  CANCELADA = 'cancelada'
}

export const FormatoCva = {
  COMBINADO: { id: 'combinado', titulo: 'Combinado', descripcion: 'Evalúa intensidad física (1–15) y calidad hedónica (1–9) simultáneamente.', tag: 'Intensidad + Calidad' },
  AFECTIVO: { id: 'afectivo', titulo: 'Afectivo', descripcion: 'Solo calidad hedónica (1–9). Mide preferencia y agrado del consumidor.', tag: 'Solo Calidad' },
  DESCRIPTIVO: { id: 'descriptivo', titulo: 'Descriptivo', descripcion: 'Solo intensidad física (1–15). Perfil sensorial objetivo sin juicio de calidad.', tag: 'Solo Intensidad' },
  EXTRINSECA: { id: 'extrinseca', titulo: 'Extrínseca', descripcion: 'Evaluación de atributos externos: origen, presentación, empaque, precio percibido.', tag: 'Atributos externos' }
} as const;

export function getFormatoById(id: string) {
  const formatos = Object.values(FormatoCva);
  return formatos.find(f => f.id.toLowerCase() === id.toLowerCase()) || FormatoCva.COMBINADO;
}

export interface Sesion {
  id: string;
  codigoAcceso: string;
  nombre: string;
  notas?: string;
  formato: string;
  numeroMuestras: number;
  catadoresObjetivo: number;
  organizadorId: string;
  organizadorParticipa: boolean;
  estado: EstadoSesion;
  creadaEn?: string;
  /** Solo al crear/editar: nombre libre de cada muestra (índice 0 = muestra 1). */
  nombresMuestras?: string[];
}

/** Recomendación (no regla): paneles de 3 o más catadores y en número impar. */
export const CATADORES_RECOMENDADOS = 3;
export const MAX_LARGO_NOMBRE_MUESTRA = 60;

export function catadoresSonRecomendados(cantidad: number): boolean {
  return cantidad >= CATADORES_RECOMENDADOS && cantidad % 2 === 1;
}

/** Nombre que el organizador dio a la muestra, o null si no tiene. */
export function nombreDeMuestra(nombres: ReadonlyMap<number, string>, numeroMuestra: number): string | null {
  const nombre = nombres.get(numeroMuestra)?.trim();
  return nombre ? nombre : null;
}

/** Normaliza la lista de nombres: recorta, limita largo y rellena hasta `total`. */
export function normalizarNombresMuestras(nombres: readonly (string | null | undefined)[], total: number): string[] {
  return Array.from({ length: total }, (_, i) => (nombres[i] ?? '').trim().slice(0, MAX_LARGO_NOMBRE_MUESTRA));
}

export interface Participante {
  id: string;
  sesionId: string;
  usuarioId: string;
  nombre: string;
  esOrganizador: boolean;
  listo: boolean;
  unidoEn?: string;
}
