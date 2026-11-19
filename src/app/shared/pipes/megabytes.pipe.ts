import { Pipe, PipeTransform } from '@angular/core';
import { megabytes } from '../utils/formato';

/** Bytes a megabytes con un decimal: {{ 1048576 | megabytes }} → "1.0". */
@Pipe({ name: 'megabytes', standalone: true })
export class MegabytesPipe implements PipeTransform {
  transform(bytes: number | null | undefined): string {
    return megabytes(bytes ?? 0);
  }
}
