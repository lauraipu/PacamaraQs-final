import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle,
  IonToolbar, NavController, ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, downloadOutline, lockClosedOutline, trophyOutline } from 'ionicons/icons';
import { getFormatoById } from '../../../core/models/sesion.model';
import { SampleConsolidatedResult, SessionResults } from '../../../core/models/session-results.model';
import { ResultsService } from '../../../core/services/results';
import { codigoDeError, mensajeDeError } from '../../../core/utils/errores';
import { CupperResultCardComponent } from '../../../shared/components/cupper-result-card/cupper-result-card.component';

export interface Clasificacion {
  etiqueta: string;
  color: string;
  fondo: string;
}

export interface FilaRanking extends SampleConsolidatedResult {
  posicion: number;
  clasificacion: Clasificacion;
}

export function clasificarPuntaje(puntaje: number): Clasificacion {
  if (puntaje >= 90) return { etiqueta: 'Excepcional', color: '#15803d', fondo: '#f0fdf4' };
  if (puntaje >= 85) return { etiqueta: 'Excelente', color: '#1d4ed8', fondo: '#eff6ff' };
  if (puntaje >= 80) return { etiqueta: 'Muy bueno', color: '#a16207', fondo: '#fefce8' };
  if (puntaje >= 75) return { etiqueta: 'Bueno', color: '#c2410c', fondo: '#fff7ed' };
  return { etiqueta: 'Regular', color: '#6c757d', fondo: '#f8f9fa' };
}

/**
 * Resultados del panel — EXCLUSIVO del organizador (o administrador).
 * Triple barrera: organizerGuard en la ruta, y en el servidor la RPC
 * get_resumen_panel verifica con EXISTS contra sesiones.organizador_id /
 * usuarios.rol_global y exige el panel cerrado.
 */
@Component({
  selector: 'app-results',
  templateUrl: './results.page.html',
  styleUrls: ['./results.page.scss'],
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonBackButton, IonButtons,
    IonIcon, IonSpinner, CupperResultCardComponent, CommonModule
  ]
})
export class ResultsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly resultsService = inject(ResultsService);
  private readonly navCtrl = inject(NavController);
  private readonly toastCtrl = inject(ToastController);

  readonly resultados = signal<SessionResults | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly accesoDenegado = signal(false);

  readonly tituloFormato = computed(() => {
    const formato = this.resultados()?.formatoCva;
    return formato ? getFormatoById(formato).titulo : '';
  });

  readonly ranking = computed<FilaRanking[]>(() => {
    const muestras = this.resultados()?.muestras ?? [];
    return [...muestras]
      .filter(m => m.evaluacionesRecibidas > 0)
      .sort((a, b) => b.puntajePromedioPanel - a.puntajePromedioPanel)
      .map((m, indice) => ({ ...m, posicion: indice + 1, clasificacion: clasificarPuntaje(m.puntajePromedioPanel) }));
  });

  readonly muestrasSinFichas = computed(
    () => this.resultados()?.muestras.filter(m => m.evaluacionesRecibidas === 0) ?? []
  );

  readonly promedioPanel = computed(() => {
    const filas = this.ranking();
    if (filas.length === 0) return 0;
    return Math.round((filas.reduce((total, f) => total + f.puntajePromedioPanel, 0) / filas.length) * 100) / 100;
  });

  readonly clasificacionPanel = computed(() => clasificarPuntaje(this.promedioPanel()));

  readonly catadoresCompletos = computed(
    () => this.resultados()?.catadores.filter(c => c.estado === 'enviado').length ?? 0
  );

  readonly porcentajeCompletado = computed(() => {
    const total = this.resultados()?.catadores.length ?? 0;
    return total === 0 ? 0 : Math.round((this.catadoresCompletos() / total) * 100);
  });

  readonly hayRecorte = computed(() => this.ranking().some(f => f.recortado));

  constructor() {
    addIcons({ checkmarkCircleOutline, downloadOutline, lockClosedOutline, trophyOutline });
  }

  async ngOnInit(): Promise<void> {
    const sesionId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!sesionId) {
      this.error.set('No se encontró el ID de la sesión.');
      this.cargando.set(false);
      return;
    }

    try {
      const resultados = await this.resultsService.obtenerResultadosSesion(sesionId);
      this.resultados.set(resultados);
      if (!resultados) this.error.set('No se encontraron resultados para esta sesión.');
    } catch (error) {
      if (codigoDeError(error) === '42501') this.accesoDenegado.set(true);
      this.error.set(mensajeDeError(error, 'No se pudieron cargar los resultados.'));
    } finally {
      this.cargando.set(false);
    }
  }

  async exportarPDF(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: 'La exportación a PDF (formato SCA) estará disponible próximamente.',
      duration: 2500,
      color: 'dark'
    });
    await toast.present();
  }

  volverAlPanel(): void {
    void this.navCtrl.navigateRoot('/dashboard');
  }
}
