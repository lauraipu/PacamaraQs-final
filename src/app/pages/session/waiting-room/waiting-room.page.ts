import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader,
  IonIcon, IonItem, IonLabel, IonList, IonSpinner, IonTitle, IonToolbar,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { copyOutline, lockClosedOutline, peopleOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { EstadoSesion, getFormatoById, Participante, Sesion } from '../../../core/models/sesion.model';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';

@Component({
  selector: 'app-waiting-room',
  templateUrl: './waiting-room.page.html',
  styleUrls: ['./waiting-room.page.scss'],
  standalone: true,
  imports: [
    IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader,
    IonIcon, IonItem, IonLabel, IonList, IonSpinner, IonTitle, IonToolbar,
    CommonModule
  ]
})
export class WaitingRoomPage implements OnInit, OnDestroy {
  sesionId = '';
  sesion: Sesion | null = null;
  usuarioActualId: string | null = null;
  esOrganizador = false;
  participantes: Participante[] = [];
  cargando = true;
  iniciando = false;
  copiando = false;
  copiado = false;
  error: string | null = null;

  // Exponer el enum para el HTML
  readonly EstadoSesion = EstadoSesion;

  private participantesSubscription?: Subscription;
  private sesionSubscription?: Subscription;
  private redirigiendo = false;
  private conectado = false;
  private connectionVersion = 0;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly sesionService = inject(SesionService);
  private readonly toastController = inject(ToastController);

  constructor() {
    addIcons({ copyOutline, lockClosedOutline, peopleOutline });
  }

  get puedeIniciar(): boolean {
    return this.participantesListos >= 3 && !this.iniciando;
  }

  get participantesListos(): number {
    return this.participantes.filter(participante => participante.listo).length;
  }

  get organizadorParticipaComoCatador(): boolean {
    const usuarioId = this.usuarioActualId?.trim().toLowerCase();
    return Boolean(
      usuarioId &&
      this.participantes.some(p => p.usuarioId?.trim().toLowerCase() === usuarioId)
    );
  }

  async ngOnInit(): Promise<void> {
    await this.conectar();
  }

  ionViewWillEnter(): void {
    void this.conectar();
  }

  ionViewWillLeave(): void {
    this.desconectar();
  }

  private async conectar(): Promise<void> {
    if (this.conectado) return;
    this.conectado = true;
    const connectionVersion = ++this.connectionVersion;
    this.cargando = true;
    this.error = null;
    this.redirigiendo = false;

    this.sesionId = this.route.snapshot.paramMap.get('sesionId')?.trim() ?? '';
    if (!this.sesionId) {
      this.error = 'No se especificó una sesión.';
      this.cargando = false;
      this.conectado = false;
      return;
    }

    try {
      const { user } = await this.authService.getUser();
      if (!this.conectado || connectionVersion !== this.connectionVersion) return;
      if (!user) throw new Error('Debes iniciar sesión para ver esta sesión.');
      this.usuarioActualId = user.id;

      this.sesion = await this.sesionService.obtenerSesionPorId(this.sesionId);
      if (!this.conectado || connectionVersion !== this.connectionVersion) return;
      if (!this.sesion) throw new Error('No se encontró la sesión solicitada.');
      this.verificarSiEsOrganizador();

      this.participantesSubscription = this.sesionService
        .observarParticipantes(this.sesionId)
        .subscribe({
          next: participantes => {
            if (connectionVersion === this.connectionVersion) {
              this.actualizarListaParticipantes(participantes);
            }
          },
          error: error => {
            if (connectionVersion !== this.connectionVersion) return;
            console.error('Error Realtime participantes:', error);
            this.error = 'No se pudo actualizar la lista de participantes.';
          }
        });

      this.sesionSubscription = this.sesionService
        .observarSesion(this.sesionId)
        .subscribe({
          next: sesionActualizada => {
            if (connectionVersion !== this.connectionVersion) return;
            this.sesion = sesionActualizada;
            this.verificarSiEsOrganizador();
            this.redirigirSiSesionIniciada();
          },
          error: error => {
            if (connectionVersion !== this.connectionVersion) return;
            console.error('Error Realtime sesión:', error);
            this.error = 'No se pudo actualizar el estado de la sesión.';
          }
        });
    } catch (error) {
      if (connectionVersion === this.connectionVersion) {
        this.error = error instanceof Error ? error.message : 'No se pudo cargar la sala de espera.';
        this.conectado = false;
      }
    } finally {
      if (connectionVersion === this.connectionVersion) this.cargando = false;
    }
  }

  ngOnDestroy(): void {
    this.desconectar();
  }

  private desconectar(): void {
    this.conectado = false;
    this.connectionVersion++;
    this.participantesSubscription?.unsubscribe();
    this.participantesSubscription = undefined;
    this.sesionSubscription?.unsubscribe();
    this.sesionSubscription = undefined;
    this.redirigiendo = false;
  }

  async copiarCodigo(): Promise<void> {
    const codigo = this.sesion?.codigoAcceso;
    if (!codigo) return;

    this.copiando = true;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigo);
      } else {
        await Clipboard.write({ string: codigo });
      }
      this.copiado = true;
      setTimeout(() => (this.copiado = false), 2000);
      const toast = await this.toastController.create({ message: '¡Código copiado!', duration: 2000, color: 'dark' });
      await toast.present();
    } catch (error) {
      this.error = 'No se pudo copiar el código.';
    } finally {
      this.copiando = false;
    }
  }

  async iniciarCata(): Promise<void> {
    if (!this.esOrganizador || !this.sesion || !this.puedeIniciar) return;

    this.iniciando = true;
    this.error = null;

    try {
      await this.sesionService.iniciarSesion(this.sesionId);
      this.sesion = { ...this.sesion, estado: EstadoSesion.INICIADA }; // Forzar estado local
      await this.redirigirSegunRol();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo iniciar la cata.';
      this.iniciando = false;
    }
  }

  private actualizarListaParticipantes(participantes: Participante[]) {
    if (!this.conectado) return;
    this.participantes = participantes;
    this.cargando = false;
    this.verificarSiEsOrganizador();
    this.redirigirSiSesionIniciada();
  }

  private verificarSiEsOrganizador(): void {
    const usuarioId = this.usuarioActualId?.trim().toLowerCase();
    const organizadorId = this.sesion?.organizadorId?.trim().toLowerCase();
    this.esOrganizador = Boolean(usuarioId && organizadorId && usuarioId === organizadorId);
  }

  private redirigirSiSesionIniciada(): void {
    if (this.sesion?.estado === EstadoSesion.INICIADA) {
      void this.redirigirSegunRol();
    }
  }

  private async redirigirSegunRol(): Promise<void> {
    if (this.redirigiendo || !this.sesion) return;
    this.redirigiendo = true;

    try {
      const esOrganizadorSinParticipar = this.esOrganizador &&
        (!this.sesion.organizadorParticipa || !this.organizadorParticipaComoCatador);

      if (esOrganizadorSinParticipar) {
        const navego = await this.router.navigateByUrl(
          `/session/${this.sesion.id}/organizer-dashboard`,
          { replaceUrl: true }
        );
        if (!navego) throw new Error('La navegación al panel del organizador fue cancelada.');
        return;
      }

      const formatoId = getFormatoById(this.sesion.formato).id;
      const rutas: Record<string, string> = {
        combinado: 'combined-form', afectivo: 'affective-form',
        descriptivo: 'descriptive-form', extrinseca: 'extrinsic-form'
      };
      const navego = await this.router.navigateByUrl(
        `/${rutas[formatoId]}/${this.sesion.id}`,
        { replaceUrl: true }
      );
      if (!navego) throw new Error('La navegación al formulario fue cancelada.');
    } catch (error) {
      this.redirigiendo = false;
      this.error = 'No se pudo abrir la pantalla de la sesión.';
    }
  }
}