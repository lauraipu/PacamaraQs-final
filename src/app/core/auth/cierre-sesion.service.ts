import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../services/auth';

/**
 * Cerrar sesión siempre pide confirmación: un toque accidental (por ejemplo,
 * durante una transición de pantalla) no debe sacar al usuario de su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class CierreSesionService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly transloco = inject(TranslocoService);
  private abierto = false;

  /** true si el usuario confirmó y se cerró la sesión. */
  async confirmarYSalir(): Promise<boolean> {
    if (this.abierto) return false;
    this.abierto = true;
    try {
      const t = (clave: string) => this.transloco.translate(clave);
      const alerta = await this.alertController.create({
        header: t('comun.confirmar_salida.titulo'),
        message: t('comun.confirmar_salida.mensaje'),
        buttons: [
          { text: t('comun.confirmar_salida.cancelar'), role: 'cancel' },
          { text: t('comun.confirmar_salida.confirmar'), role: 'confirm' }
        ]
      });
      await alerta.present();
      const { role } = await alerta.onDidDismiss();
      if (role !== 'confirm') return false;

      await this.authService.signOut();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
      return true;
    } finally {
      this.abierto = false;
    }
  }
}
