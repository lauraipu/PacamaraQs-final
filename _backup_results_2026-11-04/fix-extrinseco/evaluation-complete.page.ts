import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, lockClosedOutline } from 'ionicons/icons';
import { IonButton, IonContent, IonIcon, NavController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';

addIcons({ checkmarkCircleOutline, lockClosedOutline });

/**
 * Antes: hablaba directo con Supabase (2 consultas a `sesiones`, la segunda
 * redundante) y usaba propiedades simples → en zoneless los datos no se
 * pintaban hasta el siguiente evento. Ahora usa SesionService + signals.
 */
@Component({
  selector: 'app-evaluation-complete',
  templateUrl: './evaluation-complete.page.html',
  styleUrls: ['./evaluation-complete.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonButton]
})
export class EvaluationCompletePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navCtrl = inject(NavController);
  private readonly authService = inject(AuthService);
  private readonly sesionService = inject(SesionService);

  readonly esOrganizador = signal(false);
  readonly nombreSesion = signal('');
  readonly codigoSesion = signal('');
  readonly error = signal<string | null>(null);
  readonly cargando = signal(true);

  private sesionId = '';

  async ngOnInit(): Promise<void> {
    this.sesionId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!this.sesionId) {
      this.error.set('No se encontró el ID de la sesión.');
      this.cargando.set(false);
      return;
    }

    try {
      const { session } = await this.authService.getSession();
      const user = session?.user;
      if (!user) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      const sesion = await this.sesionService.obtenerSesionPorId(this.sesionId);
      if (!sesion) throw new Error('No se encontró la sesión.');

      this.nombreSesion.set(sesion.nombre);
      const esOrganizador = sesion.organizadorId === user.id;
      this.esOrganizador.set(esOrganizador);
      this.codigoSesion.set(esOrganizador ? sesion.codigoAcceso : '');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar la sesión.');
    } finally {
      this.cargando.set(false);
    }
  }

  async irAResultados(): Promise<void> {
    if (!this.esOrganizador() || !this.sesionId) return;
    await this.router.navigateByUrl(`/session/${this.sesionId}/results`);
  }

  volverAlPanel(): void {
    void this.navCtrl.navigateRoot('/dashboard');
  }
}
