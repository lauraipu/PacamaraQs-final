import { Injectable } from '@angular/core';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import type { ActionSheetOptions, AlertOptions, ToastOptions } from '@ionic/core';
import { tr } from './tr';

/**
 * Toasts, alertas y hojas de acción traducidas en un solo lugar: los textos
 * en español que el código pasa a `create()` se traducen al idioma activo.
 * Se registran en main.ts en lugar de los controladores de Ionic.
 */
const textoONada = (v: unknown) => (typeof v === 'string' ? tr(v) : v);
/** Traduce el texto de un botón conservando su tipo exacto (string u objeto). */
function boton<T extends { text?: string }>(b: T | string): T | string {
  if (typeof b === 'string') return tr(b);
  return typeof b.text === 'string' ? { ...b, text: tr(b.text) } : b;
}

@Injectable()
export class ToastControllerTraducido extends ToastController {
  override create(opciones?: ToastOptions) {
    return super.create(opciones && {
      ...opciones,
      header: textoONada(opciones.header) as string | undefined,
      message: textoONada(opciones.message) as ToastOptions['message'],
      buttons: opciones.buttons?.map(b => boton(b))
    });
  }
}

@Injectable()
export class AlertControllerTraducido extends AlertController {
  override create(opciones?: AlertOptions) {
    return super.create(opciones && {
      ...opciones,
      header: textoONada(opciones.header) as string | undefined,
      subHeader: textoONada(opciones.subHeader) as string | undefined,
      message: textoONada(opciones.message) as AlertOptions['message'],
      buttons: opciones.buttons?.map(b => boton(b))
    });
  }
}

@Injectable()
export class ActionSheetControllerTraducido extends ActionSheetController {
  override create(opciones?: ActionSheetOptions) {
    return super.create(opciones && {
      ...opciones,
      header: textoONada(opciones.header) as string | undefined,
      subHeader: textoONada(opciones.subHeader) as string | undefined,
      buttons: opciones.buttons.map(b => boton(b))
    });
  }
}
