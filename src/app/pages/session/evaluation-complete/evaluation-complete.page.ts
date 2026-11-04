import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, documentTextOutline, hourglassOutline, lockClosedOutline } from 'ionicons/icons';
import { IonButton, IonContent, IonIcon, NavController } from '@ionic/angular';
import { EstadoSesion, FormatoCva, getFormatoById } from '../../../core/models/sesion.model';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';

addIcons({ checkmarkCircleOutline, documentTextOutline, hourglassOutline, lockClosedOutline });

/**
 * Pantalla de cierre tras enviar la última ficha.
 *
 *  · Ya no muestra el código de acceso: caduca al iniciar la cata y el formato
 *    extrínseco no usa código (es individual).
 *  · "Ver resultados" solo aparece cuando la sesión está `completada`. Antes se
 *    ofrecía siempre al organizador y, con fichas pendientes, la RPC
 *    get_resumen_panel respondía 22023 ("…cuando el panel se cierra").
 *    Con el panel aún abierto se ofrece ir al monitoreo para finalizarlo.
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
  readonly formato = signal('');
  readonly estado = signal<EstadoSesion | null>(null);
  readonly error = signal<string | null>(null);
  readonly cargando = signal(true);

  readonly esExtrinseco = computed(() => this.formato() === FormatoCva.EXTRINSECA.id);
  readonly tituloFormato = computed(() => (this.formato() ? getFormatoById(this.formato()).titulo : ''));
  readonly panelCerrado = computed(() => this.estado() === EstadoSesion.FINALIZADA);
  /** El organizador ve resultados solo con el panel cerrado. */
  readonly puedeVerResultados = computed(() => this.esOrganizador() && this.panelCerrado());
  /** Organizador con fichas pendientes de otros catadores → debe finalizar desde el monitoreo. */
  readonly debeFinalizarPanel = computed(
    () => this.esOrganizador() && !this.panelCerrado() && !this.esExtrinseco() && this.estado() === EstadoSesion.INICIADA
  );

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
      this.formato.set(getFormatoById(sesion.formato).id);
      this.estado.set(sesion.estado);
      this.esOrganizador.set(sesion.organizadorId === user.id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar la sesión.');
    } finally {
      this.cargando.set(false);
    }
  }

  async irAResultados(): Promise<void> {
    if (!this.puedeVerResultados() || !this.sesionId) return;
    await this.router.navigateByUrl(`/session/${this.sesionId}/results`);
  }

  async irAMonitoreo(): Promise<void> {
    if (!this.esOrganizador() || !this.sesionId) return;
    await this.router.navigateByUrl(`/session/${this.sesionId}/organizer-dashboard`);
  }

  volverAlPanel(): void {
    void this.navCtrl.navigateRoot('/dashboard');
  }
}
