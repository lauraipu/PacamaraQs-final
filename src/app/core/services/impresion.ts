import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { ESTILOS_HOJA_SCA } from './estilos-hoja-sca';

/**
 * Hoja de estilos del reporte impreso. Va dentro del iframe, así que no
 * depende de Ionic, del encapsulamiento de Angular ni del tema de la app.
 */
const ESTILOS_REPORTE = `
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    color: #0f172b;
    font: 11px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .rp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
    padding-bottom: 10px; margin-bottom: 14px; border-bottom: 2px solid #2f3e46; }
  .rp-brand { margin: 0; color: #62748e; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .rp-title { margin: 2px 0 0; font-size: 18px; font-weight: 700; }
  .rp-sub { margin: 2px 0 0; color: #62748e; font-size: 11px; }
  .rp-meta { margin: 0; color: #62748e; font-size: 10px; text-align: right; white-space: nowrap; }
  .rp-section { margin: 0 0 14px; break-inside: avoid; page-break-inside: avoid; }
  .rp-section h2 { margin: 0 0 6px; color: #62748e; font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .rp-kpis { display: flex; gap: 8px; margin: 0 0 14px; }
  .rp-kpi { flex: 1; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; }
  .rp-kpi strong { display: block; color: #c2410c; font-size: 16px; }
  .rp-kpi span { color: #62748e; font-size: 9px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
  th { color: #62748e; font-size: 9px; font-weight: 600; text-transform: uppercase; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .rp-score { color: #c2410c; font-weight: 700; }
  .rp-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
  .rp-bar { position: relative; height: 8px; border-radius: 4px; background: #f1f5f9; overflow: hidden; }
  .rp-bar > i { position: absolute; inset: 0 auto 0 0; border-radius: 4px; background: #2f3e46; }
  .rp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
  .rp-dl { display: grid; grid-template-columns: 40% 60%; margin: 0; }
  .rp-dl dt, .rp-dl dd { margin: 0; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
  .rp-dl dt { color: #62748e; }
  .rp-chips span { display: inline-block; margin: 0 4px 4px 0; padding: 2px 8px; border: 1px solid #e2e8f0; border-radius: 10px; }
  .rp-muted { color: #62748e; }
  .rp-formula { margin-top: 10px; padding: 8px 10px; border-radius: 6px; background: #f1f5f9; font-family: ui-monospace, Menlo, monospace; }
  .rp-foot { margin-top: 18px; padding-top: 6px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 9px; }
  .rp-page-break { break-before: page; page-break-before: always; }
`;

const escaparHtml = (texto: string): string =>
  texto.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/**
 * Imprime HTML ya renderizado en un iframe aislado → diálogo nativo del
 * navegador, donde el usuario elige "Guardar como PDF".
 *
 * Por qué un iframe y no window.print() sobre la página: ion-content es un
 * contenedor de scroll con shadow DOM y altura fija, así que imprimir la vista
 * de Ionic corta el contenido a la parte visible e incluye toolbars y botones.
 *
 * Seguridad: el contenido proviene de una plantilla Angular renderizada; las
 * interpolaciones ya son nodos de texto escapados al serializar innerHTML.
 */
@Injectable({ providedIn: 'root' })
export class ImpresionService {
  private readonly document = inject(DOCUMENT);

  /**
   * Resuelve en cuanto se abre el diálogo de impresión (no al cerrarlo): así el
   * spinner/botón de la página se libera aunque el navegador no emita
   * `afterprint`. El iframe se elimina al cerrar el diálogo o, como respaldo, a
   * los 60 s; en ambos casos se devuelve el foco y se limpian overlays huérfanos.
   */
  imprimir(titulo: string, contenidoHtml: string): Promise<void> {
    const doc = this.document;
    const iframe = doc.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    Object.assign(iframe.style, {
      position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden'
    });

    let eliminado = false;
    let respaldo: ReturnType<typeof setTimeout> | undefined;
    const limpiar = (): void => {
      if (eliminado) return;
      eliminado = true;
      if (respaldo) clearTimeout(respaldo);
      iframe.remove();
      doc.defaultView?.focus();
      this.limpiarOverlaysHuerfanos();
    };

    return new Promise<void>((resolve, reject) => {
      iframe.onload = () => {
        const ventana = iframe.contentWindow;
        if (!ventana || typeof ventana.print !== 'function') {
          limpiar();
          reject(new Error('Este dispositivo no permite imprimir desde la app. Abre PacamaraQs en un navegador de escritorio.'));
          return;
        }
        try {
          ventana.addEventListener('afterprint', () => setTimeout(limpiar, 0), { once: true });
          respaldo = setTimeout(limpiar, 60_000);
          ventana.focus();
          ventana.print();
          resolve();
        } catch (error) {
          limpiar();
          reject(error instanceof Error ? error : new Error('No se pudo abrir el diálogo de impresión.'));
        }
      };

      iframe.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8">`
        + `<title>${escaparHtml(titulo)}</title><style>${ESTILOS_REPORTE}${ESTILOS_HOJA_SCA}</style></head>`
        + `<body>${contenidoHtml}</body></html>`;
      doc.body.appendChild(iframe);
    });
  }

  /**
   * Si no queda ningún overlay de Ionic presentado, quita lo que un cierre a
   * medias pudo dejar: `ion-backdrop` sueltos, el bloqueo de scroll del body y
   * `inert`/`aria-hidden` en la app (la pantalla quedaba sin responder).
   */
  private limpiarOverlaysHuerfanos(): void {
    const doc = this.document;
    const overlays = 'ion-modal, ion-action-sheet, ion-popover, ion-alert, ion-loading, ion-picker';
    const abiertos = Array.from(doc.querySelectorAll<HTMLElement>(overlays))
      .some(o => !o.classList.contains('overlay-hidden') && o.getAttribute('aria-hidden') !== 'true' && o.offsetParent !== null);
    if (abiertos) return;
    doc.querySelectorAll('ion-backdrop').forEach(b => { if (!b.closest(overlays + ', ion-menu')) b.remove(); });
    doc.body.classList.remove('backdrop-no-scroll');
    doc.querySelectorAll('ion-app [inert], ion-app > [aria-hidden="true"], ion-router-outlet[aria-hidden="true"]')
      .forEach(e => { e.removeAttribute('inert'); e.removeAttribute('aria-hidden'); });
  }
}
