import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonSpinner, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { LONGITUD_MINIMA_CONTRASENA, primerRequisitoFaltante } from '@domain/contrasena/politica-contrasena';
import { AuthService } from '@core/auth/auth.service';
import { codigoDeError, esSinConexion } from '@core/errores/errores';
import { CampoContrasenaComponent } from '../../../shared/components/campo-contrasena/campo-contrasena.component';
import { SelectorIdiomaComponent } from '../../../shared/components/selector-idioma/selector-idioma.component';

addIcons({ alertCircleOutline, checkmarkCircleOutline });

type Estado = 'verificando' | 'formulario' | 'invalido' | 'listo';

/**
 * Destino del enlace del correo de recuperación. Supabase abre una sesión de
 * recuperación al cargar la página (tokens en la URL) y aquí se define la
 * contraseña nueva con las reglas de contraseña segura.
 */
@Component({
  selector: 'app-nueva-contrasena',
  templateUrl: './nueva-contrasena.page.html',
  styleUrls: ['../recuperar/recuperar.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonInput, IonButton, IonSpinner, IonIcon, FormsModule, RouterLink, TranslocoPipe,
    SelectorIdiomaComponent, CampoContrasenaComponent
  ]
})
export class NuevaContrasenaPage implements OnInit {
  readonly contrasena = signal('');
  confirmacion = '';
  readonly mostrarConfirmacion = signal(false);
  readonly estado = signal<Estado>('verificando');
  readonly guardando = signal(false);
  private readonly campo = viewChild(CampoContrasenaComponent);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly transloco = inject(TranslocoService);

  readonly usuario = this.authService.usuario;
  readonly correo = computed(() => this.usuario()?.email ?? null);
  readonly nombre = computed(() => this.usuario()?.nombre ?? null);
  readonly datos = computed(() => ({ nombre: this.nombre(), email: this.correo() }));

  async ngOnInit(): Promise<void> {
    // Enlace vencido o ya usado: Supabase lo indica en la URL.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    if (hash.get('error') || query.get('error')) {
      this.estado.set('invalido');
      return;
    }
    try {
      await this.authService.asegurarInicializado();
      const { session } = await this.authService.getSession();
      this.estado.set(session?.user ? 'formulario' : 'invalido');
    } catch {
      this.estado.set('invalido');
    }
  }

  async guardar(): Promise<void> {
    if (this.guardando()) return;
    const faltante = primerRequisitoFaltante(this.contrasena(), this.datos());
    if (faltante) {
      // Mensaje concreto + se abre la ayuda con la lista de requisitos.
      const requisito = this.transloco.translate(`contrasena.req_${faltante}`, { n: LONGITUD_MINIMA_CONTRASENA });
      await this.avisarTexto(this.transloco.translate('contrasena.errores.falta', { req: requisito }));
      this.campo()?.abrirAyuda();
      return;
    }
    if (this.contrasena() !== this.confirmacion) {
      await this.avisar('contrasena.errores.no_coinciden');
      return;
    }

    this.guardando.set(true);
    try {
      await this.authService.actualizarContrasena(this.contrasena());
      this.contrasena.set('');
      this.confirmacion = '';
      this.estado.set('listo');
      await this.avisar('recuperar.actualizada', 'success');
    } catch (error) {
      const codigo = codigoDeError(error);
      if (codigo === 'same_password') await this.avisar('contrasena.errores.igual');
      else if (codigo === 'weak_password') await this.avisar('contrasena.errores.insegura');
      else if (codigo === 'session_not_found' || codigo === 'bad_jwt' || codigo === '401') this.estado.set('invalido');
      else if (esSinConexion(error)) await this.avisar('recuperar.errores.red');
      else {
        console.error('[NuevaContrasena]', error);
        await this.avisar('contrasena.errores.generico');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  async continuar(): Promise<void> {
    const destino = (await this.authService.obtenerRutaInicio().catch(() => null)) ?? '/login';
    await this.router.navigateByUrl(destino, { replaceUrl: true });
  }

  private async avisar(clave: string, color: 'danger' | 'success' = 'danger'): Promise<void> {
    await this.avisarTexto(this.transloco.translate(clave), color);
  }

  private async avisarTexto(mensaje: string, color: 'danger' | 'success' = 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3500,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
