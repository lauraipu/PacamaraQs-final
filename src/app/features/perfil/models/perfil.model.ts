/** Preferencias de accesibilidad guardadas en usuarios.preferencias. */
export interface Preferencias {
  altoContraste?: boolean;
  tamanoTexto?: number;
  reducirAnimaciones?: boolean;
}

/** Perfil editable del usuario en Configuración. */
export interface Perfil {
  nombre: string | null;
  idioma: string | null;
  preferencias: Preferencias;
}
