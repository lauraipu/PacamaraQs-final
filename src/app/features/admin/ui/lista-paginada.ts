import { computed, signal } from '@angular/core';
import { Pagina } from '../data-access/admin.models';

type Cargador<T, F> = (filtro: F, limite: number, desde: number) => Promise<Pagina<T>>;

/**
 * Estado de una lista paginada con signals (la app es zoneless).
 * `version` descarta respuestas viejas: si el usuario cambia el filtro
 * mientras una petición sigue en curso, esa respuesta ya no pisa la nueva.
 */
export class ListaPaginada<T, F> {
  readonly filas = signal<T[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly cargado = signal(false);
  readonly hayMas = computed(() => this.filas().length < this.total());

  private version = 0;

  constructor(private readonly cargador: Cargador<T, F>, private readonly tamano = 25) {}

  reiniciar(filtro: F): Promise<void> {
    return this.pedir(filtro, 0, false);
  }

  siguiente(filtro: F): Promise<void> {
    if (this.cargando() || !this.hayMas()) return Promise.resolve();
    return this.pedir(filtro, this.filas().length, true);
  }

  /** Reemplaza una fila en memoria (por ejemplo tras cambiar un rol). */
  actualizar(predicado: (fila: T) => boolean, cambio: (fila: T) => T): void {
    this.filas.update(filas => filas.map(f => (predicado(f) ? cambio(f) : f)));
  }

  private async pedir(filtro: F, desde: number, agregar: boolean): Promise<void> {
    const version = ++this.version;
    this.cargando.set(true);
    this.error.set(false);
    try {
      const pagina = await this.cargador(filtro, this.tamano, desde);
      if (version !== this.version) return;
      this.filas.set(agregar ? [...this.filas(), ...pagina.filas] : pagina.filas);
      this.total.set(pagina.total);
    } catch (error) {
      if (version !== this.version) return;
      console.error('[Admin]', error);
      this.error.set(true);
    } finally {
      if (version === this.version) {
        this.cargando.set(false);
        this.cargado.set(true);
      }
    }
  }
}
