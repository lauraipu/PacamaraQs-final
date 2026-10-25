import { TestBed } from '@angular/core/testing';
import { EvaluationService } from './evaluation';
import { SupabaseService } from './supabase';

describe('EvaluationService', () => {
  let service: EvaluationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EvaluationService,
        { provide: SupabaseService, useValue: { client: {} } }
      ]
    });
    service = TestBed.inject(EvaluationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
