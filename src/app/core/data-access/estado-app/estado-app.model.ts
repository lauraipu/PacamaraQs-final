/** Estado general de la plataforma que ve cualquier usuario autenticado. */
export interface EstadoApp {
  enPausa: boolean;
  /** Mensaje que escribió el administrador para la pausa. */
  mensaje: string;
  /** Fecha de una pausa programada que aún no empieza (null si no hay). */
  pausaProgramada: Date | null;
  registrosAbiertos: boolean;
}
