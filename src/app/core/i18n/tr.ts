import { ChangeDetectorRef, inject, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { PATRONES } from './patrones';

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
    .replace(/[\u0300-\u036f]/g, '')
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

/**
 * Traduce `texto` (español). Con `params`, el texto lleva {{p0}}, {{p1}}…
 * Sin coincidencia exacta se prueba:
 *  1. Textos compuestos separados por " · " o " | " → se traduce cada parte.
 *  2. Patrones con datos ("Ficha guardada en la muestra 3 de…", errores del
 *     servidor con valores) → se traduce la plantilla y se conservan los datos.
 * Lo que no tiene traducción (nombres, notas escritas por el usuario) queda igual.
 */
export function tr(texto: string | null | undefined, params?: Record<string, unknown>): string {
  if (!texto) return texto ?? '';
  if (params) return interpolar(traducirClave(texto, params) ?? texto, params);
  if (!transloco) return texto;
  return traducirClave(texto) ?? porPartes(texto) ?? porPatron(texto) ?? texto;
}

function traducirClave(texto: string, params?: Record<string, unknown>): string | null {
  if (!transloco) return null;
  const clave = claveTexto(texto);
  const traducido = transloco.translate(clave, params);
  return traducido && traducido !== clave ? traducido : null;
}

function interpolar(texto: string, params: Record<string, unknown>): string {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => String(params[k] ?? ''));
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let patronesCompilados: { fuente: string; re: RegExp; nombres: string[] }[] | null = null;

function porPatron(texto: string): string | null {
  patronesCompilados ??= PATRONES.map(fuente => {
    const nombres: string[] = [];
    const re = new RegExp('^' + escapar(fuente).replace(/\\\{\\\{(p\d+)\\\}\\\}/g, (_, n: string) => {
      nombres.push(n);
      return '([\\s\\S]+?)';
    }) + '$');
    return { fuente, re, nombres };
  });
  for (const { fuente, re, nombres } of patronesCompilados) {
    const m = re.exec(texto);
    if (!m) continue;
    // Los datos también se traducen si son textos conocidos ("notas", listas de descriptores…).
    const params = Object.fromEntries(nombres.map((n, i) => [n, traducirLista(m[i + 1])]));
    return interpolar(traducirClave(fuente, params) ?? fuente, params);
  }
  return null;
}

function traducirLista(valor: string): string {
  const exacto = traducirClave(valor);
  if (exacto) return exacto;
  return valor.includes(', ') ? valor.split(', ').map(v => traducirClave(v) ?? v).join(', ') : valor;
}

function porPartes(texto: string): string | null {
  const sep = texto.includes(' · ') ? ' · ' : texto.includes(' | ') ? ' | ' : null;
  if (!sep) return null;
  const partes = texto.split(sep);
  const traducidas = partes.map(p => traducirClave(p) ?? porPatron(p) ?? p);
  return traducidas.some((t, i) => t !== partes[i]) ? traducidas.join(sep) : null;
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
