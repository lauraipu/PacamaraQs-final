import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/** Booleano traducido: {{ true | siNo }} → "Sí" / "Yes" / "Sì" / "是". */
@Pipe({ name: 'siNo', standalone: true, pure: false })
export class SiNoPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(valor: boolean | null | undefined): string {
    if (valor === null || valor === undefined) return '';
    return this.transloco.translate(valor ? 'comun.si' : 'comun.no');
  }
}
