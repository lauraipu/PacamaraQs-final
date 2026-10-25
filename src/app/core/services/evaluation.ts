import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private readonly supabase = inject(SupabaseService);
}

export { EvaluationService as Evaluation };
