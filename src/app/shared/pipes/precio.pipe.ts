import { Pipe, PipeTransform } from '@angular/core';
import { formatearPrecio } from '../utils/formato';

/**
 * Precio con su moneda: {{ 25000 | precio }} → "$ 25.000 COP".
 */
@Pipe({ name: 'precio', standalone: true })
export class PrecioPipe implements PipeTransform {
  transform(valor: number | null | undefined, moneda = 'COP'): string {
    return valor === null || valor === undefined ? '' : formatearPrecio(valor, moneda);
  }
}
