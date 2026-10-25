import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, personCircleOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { getFormatoById, Participante, Sesion } from '../../../core/models/sesion.model';
import { SesionService } from '../../../core/services/sesion';

addIcons({ checkmarkCircle, personCircleOutline });

@Component({
  selector: 'app-waiting-room',
  templateUrl: './waiting-room.page.html',
  styleUrls: ['./waiting-room.page.scss'],
  standalone: true,
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonTitle,
    IonToolbar,
    CommonModule
  ]
})
export class WaitingRoomPage implements OnInit, OnDestroy {
  sesionId = '';
  sesion: Sesion | null = null;
  participantes: Participante[] = [];
  cargando = true;
  iniciando = false;
  copiando = false;
  copiado = false;
  error: string | null = null;
  private participantesSubscription?: Subscription;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sesionService = inject(SesionService);
  private readonly toastController = inject(ToastController);

  ngOnInit(): void {
    this.sesionId = this.route.snapshot.paramMap.get('sesionId') ?? '';
    if (!this.sesionId) {
      this.error = 'No se especificó una sesión.';
      this.cargando = false;
      return;
    }

    void this.cargarSesion();
    this.participantesSubscription = this.sesionService
      .observarParticipantes(this.sesionId)
      .subscribe({
        next: participantes => {
          this.participantes = participantes;
          this.cargando = false;
        },
        error: error => {
          this.error = error instanceof Error
            ? error.message
            : 'No se pudieron cargar los participantes.';
          this.cargando = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.participantesSubscription?.unsubscribe();
  }

  async copiarCodigo(): Promise<void> {
    const codigo = this.sesion?.codigoAcceso;
    if (!codigo) {
      this.error = 'No hay un código de sesión para copiar.';
      return;
    }

    this.copiando = true;
    this.error = null;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigo);
      } else {
        await Clipboard.write({ string: codigo });
      }
      this.copiado = true;
      window.setTimeout(() => this.copiado = false, 2000);
      const toast = await this.toastController.create({
        message: '¡Código copiado!',
        duration: 2000,
        color: 'dark'
      });
      await toast.present();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo copiar el código.';
      const toast = await this.toastController.create({
        message: `No se pudo copiar el código. ${this.error}`,
        duration: 3500,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.copiando = false;
    }
  }

  async iniciarCata(): Promise<void> {
    if (!this.sesion) {
      this.error = 'No se pudo cargar la información de la sesión.';
      return;
    }

    this.iniciando = true;
    this.error = null;
    try {
      await this.sesionService.iniciarSesion(this.sesionId);
      const formatoId = getFormatoById(this.sesion.formato).id;
      const rutasFormato: Record<string, string> = {
        combinado: 'combined-form',
        afectivo: 'affective-form',
        descriptivo: 'descriptive-form',
        extrinseca: 'extrinsic-form'
      };
      await this.router.navigateByUrl(`/${rutasFormato[formatoId]}`);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo iniciar la cata.';
    } finally {
      this.iniciando = false;
    }
  }

  private async cargarSesion(): Promise<void> {
    try {
      this.sesion = await this.sesionService.obtenerSesionPorId(this.sesionId);
      if (!this.sesion) this.error = 'No se encontró la sesión solicitada.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo cargar la sesión.';
    }
  }
}
