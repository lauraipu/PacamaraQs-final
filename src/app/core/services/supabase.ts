import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService { // <-- Mantenemos el nombre de la clase
  private supabaseClient?: SupabaseClient;

  get client(): SupabaseClient {
    if (this.supabaseClient) return this.supabaseClient;

    if (!environment.supabaseUrl.trim() || !environment.supabaseKey.trim()) {
      throw new Error('Configura supabaseUrl y supabaseKey en el archivo de entorno antes de usar Supabase.');
    }

    this.supabaseClient = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
    return this.supabaseClient;
  }
}

export { SupabaseService as Supabase };