import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
  IonLabel, IonIcon, IonButton, NavController
} from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { SesionService } from '../../../core/services/sesion';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { personCircleOutline } from 'ionicons/icons';

addIcons({ personCircleOutline });

@Component({
  selector: 'app-organizer-dashboard',
  templateUrl: './organizer-dashboard.page.html',
  styleUrls: ['./organizer-dashboard.page.scss'],
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonLabel, IonIcon, IonButton, CommonModule
  ]
})
export class OrganizerDashboardPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sesionService = inject(SesionService);
  private navCtrl = inject(NavController);

  sesionId = '';
  nombreSesion = '';
  participantes: any[] = [];
  completados = 0;
  private sub?: Subscription;
  private conectado = false;
  private connectionVersion = 0;

  ngOnInit(): void {
    void this.conectar();
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
    this.sesionId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.sesionId) {
      this.conectado = false;
      return;
    }

    try {
      const sesion = await this.sesionService.obtenerSesionPorId(this.sesionId);
      if (!this.conectado || connectionVersion !== this.connectionVersion) return;
      if (sesion) this.nombreSesion = sesion.nombre;

      this.sub = this.sesionService.observarParticipantes(this.sesionId).subscribe({
        next: data => {
          if (connectionVersion !== this.connectionVersion) return;
          this.participantes = data;
          this.completados = data.length;
        },
        error: error => {
          if (connectionVersion === this.connectionVersion) {
            console.error('Error al observar participantes:', error);
          }
        }
      });
    } catch (error) {
      if (connectionVersion === this.connectionVersion) {
        this.conectado = false;
        console.error('No se pudo cargar el panel del organizador:', error);
      }
    }
  }

  ngOnDestroy(): void {
    this.desconectar();
  }

  private desconectar(): void {
    this.conectado = false;
    this.connectionVersion++;
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  cerrarSesion() {
    this.router.navigateByUrl(`/session/${this.sesionId}/results`);
  }
}