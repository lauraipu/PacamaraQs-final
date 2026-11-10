import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CupperResultSummary } from '../../../core/models/session-results.model';

import { TranslocoPipe } from '@jsverse/transloco';
@Component({
  selector: 'app-cupper-result-card',
  templateUrl: './cupper-result-card.component.html',
  styleUrls: ['./cupper-result-card.component.scss'],
  standalone: true,
  imports: [TranslocoPipe, CommonModule]
})
export class CupperResultCardComponent {
  @Input() catador!: CupperResultSummary;

  get esGeneroso(): boolean {
    return this.catador.desviacionRespectoPanel > 0.5;
  }
  get esEstricto(): boolean {
    return this.catador.desviacionRespectoPanel < -0.5;
  }
  get estaCalibrado(): boolean {
    return Math.abs(this.catador.desviacionRespectoPanel) <= 0.5;
  }
}