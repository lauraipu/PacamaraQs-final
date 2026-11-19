import { Pipe, PipeTransform } from '@angular/core';
import { formatearPrecio } from '@domain/origenes/origenes';

/**
 * Precio con su moneda: {{ 25000 | precio }} → "$ 25.000 COP".
 * formatearPrecio sigue en domain/origenes hasta el paso 9, cuando el mapper de
 * ficha técnica salga de core/ (core no puede importar shared/).
 */
@Pipe({ name: 'precio', standalone: true })
export class PrecioPipe implements PipeTransform {
  transform(valor: number | null | undefined, moneda = 'COP'): string {
    return valor === null || valor === undefined ? '' : formatearPrecio(valor, moneda);
  }
}
