import { CanDeactivateFn } from '@angular/router';

/** Pantallas que piden confirmación antes de salir (formularios de cata). */
export interface ConSalidaControlada {
  puedeSalir(): Promise<boolean> | boolean;
}

/**
 * Cubre todas las formas de salir: flecha de la pantalla, botón o gesto
 * "atrás" de Android y cualquier navegación. Las salidas programadas
 * (enviar fichas, sesión cerrada por el organizador) no preguntan.
 */
export const salidaFormularioGuard: CanDeactivateFn<ConSalidaControlada> = componente =>
  typeof componente?.puedeSalir === 'function' ? componente.puedeSalir() : true;
