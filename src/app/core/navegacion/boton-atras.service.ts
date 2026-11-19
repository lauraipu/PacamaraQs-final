import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { NavController, Platform } from '@ionic/angular';
import { AuthService } from '../services/auth';

/** Pantallas raíz: en ellas "atrás" minimiza la app en vez de navegar. */
const RAICES = ['/dashboard', '/admin-dashboard', '/login'];
/** Pantallas a las que "atrás" nunca debe regresar con una sesión activa. */
const SOLO_SIN_SESION = ['/login', '/registro', '/recuperar'];

/**
 * Botón / gesto "atrás" de Android.
 *
 * Problema que corrige: la app no escuchaba `backButton`, así que Android
 * retrocedía por el historial del navegador interno, que conserva /login y
 * /registro; el usuario veía el login con la sesión aún abierta y creía que
 * se había salido de la cuenta.
 *
 * Ahora: Ionic retrocede dentro de su pila de pantallas (prioridad 0). Si no
 * hay a dónde volver, este manejador (prioridad -1) minimiza la app en las
 * pantallas raíz o lleva al panel del usuario en las demás.
 */
@Injectable({ providedIn: 'root' })
export class BotonAtrasService {
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly navCtrl = inject(NavController);
  private readonly authService = inject(AuthService);
  private iniciado = false;

  iniciar(): void {
    if (this.iniciado || !Capacitor.isNativePlatform()) return;
    this.iniciado = true;

    // Con un oyente registrado, Android deja de retroceder solo por el historial web.
    void App.addListener('backButton', () => undefined);

    this.platform.backButton.subscribeWithPriority(-1, () => {
      void this.manejar();
    });
  }

  private async manejar(): Promise<void> {
    const ruta = this.router.url.split(/[?#]/)[0];
    const conSesion = this.authService.autenticado();

    if (RAICES.includes(ruta) || (!conSesion && ruta === '/login')) {
      await App.minimizeApp();
      return;
    }

    if (!conSesion) {
      await this.navCtrl.navigateRoot('/login');
      return;
    }

    const inicio = (await this.authService.obtenerRutaInicio().catch(() => null)) ?? '/dashboard';
    if (SOLO_SIN_SESION.includes(ruta) || ruta !== inicio) {
      await this.navCtrl.navigateRoot(inicio, { animationDirection: 'back' });
    }
  }
}
