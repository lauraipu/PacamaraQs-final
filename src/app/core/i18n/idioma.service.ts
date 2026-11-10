import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { registrarTraductor } from './tr';

export const IDIOMAS = ['es', 'en', 'it', 'zh'] as const;
export type Idioma = (typeof IDIOMAS)[number];

const CLAVE = 'pacamaraqs.idioma';
/** Atributo lang del <html>: lectores de pantalla y tipografía china correctos. */
const LANG_HTML: Record<Idioma, string> = { es: 'es', en: 'en', it: 'it', zh: 'zh-Hans' };

/**
 * Idioma de la interfaz. Por defecto el del celular; el usuario puede cambiarlo
 * y la elección se recuerda en este dispositivo.
 */
@Injectable({ providedIn: 'root' })
export class IdiomaService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly _actual = signal<Idioma>('es');
  readonly actual = this._actual.asReadonly();

  /** APP_INITIALIZER: espera el primer archivo de traducciones para no "parpadear" claves. */
  iniciar(): Promise<unknown> {
    registrarTraductor(this.transloco);
    const idioma = this.guardado() ?? this.delDispositivo();
    this.aplicar(idioma);
    return new Promise(resolve => {
      this.transloco.load(idioma).subscribe({ next: resolve, error: resolve });
    });
  }

  cambiar(valor: unknown): void {
    const idioma = IDIOMAS.find(i => i === valor);
    if (!idioma) return;
    this.aplicar(idioma);
    try { localStorage.setItem(CLAVE, idioma); } catch { /* modo privado */ }
  }

  private aplicar(idioma: Idioma): void {
    this._actual.set(idioma);
    this.transloco.setActiveLang(idioma);
    this.document.documentElement.lang = LANG_HTML[idioma];
  }

  private guardado(): Idioma | null {
    try {
      const valor = localStorage.getItem(CLAVE);
      return IDIOMAS.find(i => i === valor) ?? null;
    } catch {
      return null;
    }
  }

  private delDispositivo(): Idioma {
    const preferidos = this.document.defaultView?.navigator.languages ?? [];
    for (const lang of preferidos) {
      const base = lang.toLowerCase().split('-')[0];
      const idioma = IDIOMAS.find(i => i === base);
      if (idioma) return idioma;
    }
    return 'es';
  }
}
