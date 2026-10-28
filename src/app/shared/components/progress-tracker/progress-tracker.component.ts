import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-tracker',
  templateUrl: './progress-tracker.component.html',
  styleUrls: ['./progress-tracker.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class ProgressTrackerComponent {
  @Input() completados = 0;
  @Input() total = 0;

  get porcentaje(): number {
    if (this.total === 0) return 0;
    return Math.round((this.completados / this.total) * 100);
  }
}