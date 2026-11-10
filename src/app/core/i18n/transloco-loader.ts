import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

/** Traducciones en src/assets/i18n/<idioma>.json (incluidas en la APK, sin red). */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(idioma: string) {
    return this.http.get<Translation>(`assets/i18n/${idioma}.json`);
  }
}
