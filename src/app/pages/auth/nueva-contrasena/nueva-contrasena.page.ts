import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonSpinner, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { contrasenaEsSegura } from '../../../core/auth/politica-contrasena';
import { AuthService } from '../../../core/services/auth';
import { codigoDeError, esSinConexion } from '../../../core/utils/errores';
import { RequisitosContrasenaComponent } from '../../../shared/components/requisitos-contrasena/requisitos-contrasena.component';
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
    SelectorIdiomaComponent, RequisitosContrasenaComponent
  ]
})
export class NuevaContrasenaPage implements OnInit {
  contrasena = '';
  confirmacion = '';
  mostrar = false;
  readonly estado = signal<Estado>('verificando');
  readonly guardando = signal(false);
  /** Copia en signal para que el medidor se actualice al escribir (app zoneless). */
  readonly valorActual = signal('');

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly transloco = inject(TranslocoService);

  readonly usuario = this.authService.usuario;
  readonly correo = computed(() => this.usuario()?.email ?? null);
  readonly nombre = computed(() => this.usuario()?.nombre ?? null);

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

  alEscribir(valor: string | null | undefined): void {
    this.contrasena = valor ?? '';
    this.valorActual.set(this.contrasena);
  }

  async guardar(): Promise<void> {
    if (this.guardando()) return;
    if (!contrasenaEsSegura(this.contrasena, { nombre: this.nombre(), email: this.correo() })) {
      await this.avisar('contrasena.errores.insegura');
      return;
    }
    if (this.contrasena !== this.confirmacion) {
      await this.avisar('contrasena.errores.no_coinciden');
      return;
    }

    this.guardando.set(true);
    try {
      await this.authService.actualizarContrasena(this.contrasena);
      this.contrasena = '';
      this.confirmacion = '';
      this.valorActual.set('');
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
    const toast = await this.toastController.create({
      message: this.transloco.translate(clave),
      duration: 3500,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
