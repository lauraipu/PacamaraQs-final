import { Pipe, PipeTransform } from '@angular/core';

/**
 * Texto de respaldo cuando el dato falta: {{ u.nombre | respaldo: u.email }}.
 * Así el modelo guarda null y la pantalla decide qué mostrar (sin '—' en los mappers).
 */
@Pipe({ name: 'respaldo', standalone: true })
export class RespaldoPipe implements PipeTransform {
  transform(valor: string | null | undefined, alternativa = '—'): string {
    const texto = valor?.trim();
    return texto ? texto : alternativa;
  }
}
