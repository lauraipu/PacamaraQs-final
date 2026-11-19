import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../services/auth';
import { SupabaseService } from '../services/supabase';
import { IdGuia } from './guias';

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
  private readonly supabase = inject(SupabaseService);
  private vistas: Set<string> | null = null;
  private abierta = false;

  async mostrarSiPrimeraVez(id: IdGuia): Promise<void> {
    // Las guías nunca deben romper una pantalla: cualquier fallo se ignora.
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return;
    try {
      const vistas = await this.cargarVistas();
      if (vistas.has(id) || this.abierta) return;
      await this.abrir(id);
      vistas.add(id);
      this.guardarLocal(vistas);
      void this.supabase.client.rpc('marcar_guia_vista', { p_guia: id }).then(() => undefined, () => undefined);
    } catch (error) {
      console.warn('[Guías]', error);
    }
  }

  async abrir(id: IdGuia): Promise<void> {
    if (this.abierta) return;
    this.abierta = true;
    try {
      const { GuiaModalComponent } = await import('../../shared/components/guia/guia-modal.component');
      const modal = await this.modales.create({
        component: GuiaModalComponent,
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
      const { data } = await this.supabase.client.from('usuarios').select('preferencias').eq('id', id).maybeSingle();
      const remotas = (data?.preferencias as { guias?: unknown } | null)?.guias;
      if (Array.isArray(remotas)) remotas.forEach(g => typeof g === 'string' && locales.add(g));
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
