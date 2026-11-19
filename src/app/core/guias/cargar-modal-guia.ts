import { InjectionToken, Type } from '@angular/core';

/**
 * Carga diferida del componente visual de las guías. Lo provee main.ts:
 * así core/ no importa nada de shared/ (regla de fronteras, punto B2).
 */
export const CARGAR_MODAL_GUIA = new InjectionToken<() => Promise<Type<unknown>>>('CARGAR_MODAL_GUIA');
