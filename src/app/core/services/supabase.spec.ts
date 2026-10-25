import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase';

describe('SupabaseService', () => {
  let service: SupabaseService;

  beforeEach(() => {
    environment.supabaseUrl = 'https://example.supabase.co';
    environment.supabaseKey = 'test-anon-key';
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
