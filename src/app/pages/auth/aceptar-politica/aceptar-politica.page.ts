import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonCheckbox, IonContent, IonSpinner, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/services/auth';
import { SelectorIdiomaComponent } from '../../../shared/components/selector-idioma/selector-idioma.component';
import { TextoPoliticaComponent } from '../../../shared/components/texto-politica/texto-politica.component';

/**
 * Aceptación obligatoria de la política de datos (Ley 1581 de 2012).
 * La ve quien no la ha aceptado en su versión vigente; en la práctica, quien
 * entra por primera vez con Google (el registro por correo ya la incluye).
 * authGuard no deja usar el resto de la app hasta aceptar.
 */
@Component({
  selector: 'app-aceptar-politica',
  templateUrl: './aceptar-politica.page.html',
  styleUrls: ['./aceptar-politica.page.scss'],
  standalone: true,
  imports: [IonContent, IonButton, IonCheckbox, IonSpinner, FormsModule, TranslocoPipe, TextoPoliticaComponent, SelectorIdiomaComponent]
})
export class AceptarPoliticaPage {
  aceptada = false;
  readonly guardando = signal(false);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastCtrl = inject(ToastController);
  private readonly transloco = inject(TranslocoService);

  async aceptar(): Promise<void> {
    if (this.guardando()) return;
    if (!this.aceptada) {
      await this.avisar('politica.requerida');
      return;
    }
    this.guardando.set(true);
    try {
      await this.authService.aceptarPolitica();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const interna = !!returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.startsWith('/aceptar-politica');
      const destino = interna ? returnUrl : (await this.authService.obtenerRutaInicio()) ?? '/login';
      await this.router.navigateByUrl(destino, { replaceUrl: true });
    } catch (error) {
      console.error('[AceptarPolitica]', error);
      await this.avisar('politica.error');
    } finally {
      this.guardando.set(false);
    }
  }

  async rechazar(): Promise<void> {
    await this.authService.signOut().catch(() => undefined);
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async avisar(clave: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message: this.transloco.translate(clave), duration: 3500, position: 'bottom', color: 'danger' });
    await toast.present();
  }
}
