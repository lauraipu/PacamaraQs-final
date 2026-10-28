import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SampleConsolidatedResult } from '../../../core/models/session-results.model';

@Component({
  selector: 'app-sample-result-card',
  templateUrl: './sample-result-card.component.html',
  styleUrls: ['./sample-result-card.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class SampleResultCardComponent {
  @Input() muestra!: SampleConsolidatedResult;
}