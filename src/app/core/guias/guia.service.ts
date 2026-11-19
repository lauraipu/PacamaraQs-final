import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../auth/auth.service';
import { CARGAR_MODAL_GUIA } from './cargar-modal-guia';
import { IdGuia } from './guias';
import { GuiasRepository } from './guias.repository';

const CLAVE_LOCAL = 'pacamaraqs.guias';

/**
 * Muestra cada guía la primera vez que el usuario entra a una pantalla.
 * Las vistas se recuerdan en la cuenta (usuarios.preferencias.guias) y en el
 * dispositivo, así no se repiten al cambiar de celular ni sin conexión.
 */
@Injectable({ providedIn: 'root' })
export class GuiaService {
  private readonly modales = inject(ModalController);
  private readonly auth = inject(AuthService);
  private readonly repositorio = inject(GuiasRepository);
  /** Opcional: en pruebas unitarias no se provee y la guía simplemente no se abre. */
  private readonly cargarModal = inject(CARGAR_MODAL_GUIA, { optional: true });
  private vistas: Set<string> | null = null;
  private abierta = false;

  async mostrarSiPrimeraVez(id: IdGuia): Promise<void> {
    // Las guías nunca deben romper una pantalla: cualquier fallo se ignora.
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return;
    try {
      const vistas = await this.cargarVistas();
      if (vistas.has(id) || this.abierta) return;
      // Se guarda ANTES de abrir el modal (dispositivo y cuenta): si la persona
      // navega, recarga o cierra sin tocar "Entendido", igual queda marcada
      // como vista y no vuelve a aparecer.
      vistas.add(id);
      this.guardarLocal(vistas);
      this.repositorio.marcarVista(id);
      await this.abrir(id);
    } catch (error) {
      console.warn('[Guías]', error);
    }
  }

  async abrir(id: IdGuia): Promise<void> {
    if (this.abierta || !this.cargarModal) return;
    this.abierta = true;
    try {
      const componente = await this.cargarModal();
      const modal = await this.modales.create({
        component: componente,
        componentProps: { id },
        cssClass: 'guia-modal',
        breakpoints: [0, 1],
        initialBreakpoint: 1
      });
      await modal.present();
      await modal.onDidDismiss();
    } finally {
      this.abierta = false;
    }
  }

  private async cargarVistas(): Promise<Set<string>> {
    if (this.vistas) return this.vistas;
    const locales = this.leerLocal();
    const id = typeof this.auth.usuario === 'function' ? this.auth.usuario()?.id : undefined;
    if (id) {
      (await this.repositorio.vistasEnLaCuenta(id)).forEach(g => locales.add(g));
    }
    this.vistas = locales;
    return locales;
  }

  private leerLocal(): Set<string> {
    try {
      const valor = JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? '[]');
      return new Set(Array.isArray(valor) ? valor.filter((g): g is string => typeof g === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private guardarLocal(vistas: Set<string>): void {
    try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify([...vistas])); } catch { /* sin almacenamiento */ }
  }
}
