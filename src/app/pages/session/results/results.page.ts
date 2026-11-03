import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
  IonBackButton, IonButtons, IonSpinner, NavController
} from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { ResultsService } from '../../../core/services/results';
import { SessionResults } from '../../../core/models/session-results.model';
import { ProgressTrackerComponent } from '../../../shared/components/progress-tracker/progress-tracker.component';
import { SampleResultCardComponent } from '../../../shared/components/sample-result-card/sample-result-card.component';
import { CupperResultCardComponent } from '../../../shared/components/cupper-result-card/cupper-result-card.component';

@Component({
  selector: 'app-results',
  templateUrl: './results.page.html',
  styleUrls: ['./results.page.scss'],
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
    IonBackButton, IonButtons, IonSpinner,
    ProgressTrackerComponent, SampleResultCardComponent, CupperResultCardComponent,
    CommonModule
  ]
})
export class ResultsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private resultsService = inject(ResultsService);
  private navCtrl = inject(NavController);

  resultados: SessionResults | null = null;
  cargando = true;
  error: string | null = null;

  async ngOnInit() {
    const sesionId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!sesionId) {
      this.error = 'No se encontró el ID de la sesión.';
      this.cargando = false;
      return;
    }

    try {
      this.resultados = await this.resultsService.obtenerResultadosSesion(sesionId);
      if (!this.resultados) this.error = 'No se encontraron resultados para esta sesión.';
    } catch (error) {
      console.error('Error al cargar los resultados de la sesión:', error);
      this.error = error instanceof Error ? error.message : 'No se pudieron cargar los resultados.';
    } finally {
      this.cargando = false;
    }
  }

  exportarPDF() {
    alert('Aquí irá la generación del PDF de la SCA.');
  }

  volverAlPanel() {
    this.navCtrl.navigateRoot('/dashboard');
  }
}