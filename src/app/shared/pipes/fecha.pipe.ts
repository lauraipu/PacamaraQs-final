import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { formatearDiaCorto, formatearFecha } from '../utils/formato';

export type EstiloFecha = 'fecha' | 'fechaHora' | 'diaCorto';

/**
 * Fecha en el idioma activo: {{ d | fecha }}, {{ d | fecha: 'fechaHora' }}, {{ d | fecha: 'diaCorto' }}.
 * Impuro para que cambie al cambiar de idioma.
 */
@Pipe({ name: 'fecha', standalone: true, pure: false })
export class FechaPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(valor: Date | string | null | undefined, estilo: EstiloFecha = 'fecha'): string {
    if (!valor) return '';
    const fecha = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    const idioma = this.transloco.getActiveLang();
    return estilo === 'diaCorto' ? formatearDiaCorto(fecha, idioma) : formatearFecha(fecha, idioma, estilo === 'fechaHora');
  }
}
