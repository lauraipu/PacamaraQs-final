import { ChangeDetectorRef, inject, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

/**
 * Traducción de textos que NO están en las plantillas: datos (nombres de
 * atributos, descriptores, formatos, países…) y mensajes generados en el
 * código (toasts, errores). El texto en español sigue siendo la fuente en el
 * código y en la base de datos; la clave se deriva del propio texto, así que
 * no hay que cambiar modelos ni datos guardados.
 *
 * Si un texto no tiene traducción (p. ej. el nombre de una sesión o de una
 * persona), se muestra tal cual.
 */
let transloco: TranslocoService | null = null;

/** Lo llama IdiomaService al iniciar la app. */
export function registrarTraductor(servicio: TranslocoService): void {
  transloco = servicio;
}

/** Clave estable del texto: slug + hash FNV-1a (igual al script que genera los JSON). */
export function claveTexto(texto: string): string {
  const slug = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
    .replace(/^_+|_+$/g, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `txt.${slug || 't'}_${h.toString(36)}`;
}

export function tr(texto: string | null | undefined): string {
  if (!texto) return texto ?? '';
  if (!transloco) return texto;
  const clave = claveTexto(texto);
  const traducido = transloco.translate(clave);
  return traducido && traducido !== clave ? traducido : texto;
}

/** `{{ valor | tr }}`: traduce datos; impuro para reaccionar al cambio de idioma. */
@Pipe({ name: 'tr', standalone: true, pure: false })
export class TrPipe implements PipeTransform, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sub: Subscription | undefined;
  private ultimoTexto: unknown;
  private ultimoIdioma = '';
  private ultimoResultado = '';

  constructor() {
    this.sub = transloco?.events$.subscribe(() => this.cdr.markForCheck());
  }

  transform(valor: string | null | undefined): string {
    const idioma = transloco?.getActiveLang() ?? '';
    if (valor === this.ultimoTexto && idioma === this.ultimoIdioma) return this.ultimoResultado;
    this.ultimoTexto = valor;
    this.ultimoIdioma = idioma;
    this.ultimoResultado = tr(valor);
    return this.ultimoResultado;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
