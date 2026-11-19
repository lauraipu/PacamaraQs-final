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
