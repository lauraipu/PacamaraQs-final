import { ErrorHandler, inject, Injectable, Injector } from '@angular/core';
import { AvisosService } from './avisos.service';

/** Errores conocidos que no deben molestar al usuario. */
const IGNORADOS = [/ResizeObserver/i, /NavigationCancel/i, /Navigation ID \d+ is not equal/i, /Missing translation/i];
const ESPERA_MS = 8000;

/**
 * Último recurso: un error no capturado se registra y se muestra un aviso
 * genérico (como máximo uno cada 8 s) en vez de dejar la app colgada sin explicación.
 */
@Injectable()
export class ManejadorErrores implements ErrorHandler {
  private readonly injector = inject(Injector);
  private ultimoAviso = 0;

  handleError(error: unknown): void {
    console.error(error);
    const texto = String((error as { message?: unknown })?.message ?? error);
    if (IGNORADOS.some(patron => patron.test(texto))) return;
    const ahora = Date.now();
    if (ahora - this.ultimoAviso < ESPERA_MS) return;
    this.ultimoAviso = ahora;
    // Se obtiene tarde: inyectarlo en el constructor crea una dependencia circular.
    void this.injector.get(AvisosService).error('errores.inesperado').catch(() => undefined);
  }
}
