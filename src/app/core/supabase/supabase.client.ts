import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabaseClient?: SupabaseClient;

  get client(): SupabaseClient {
    if (this.supabaseClient) return this.supabaseClient;

    if (!environment.supabaseUrl.trim() || !environment.supabaseKey.trim()) {
      throw new Error('Configura supabaseUrl y supabaseKey en el archivo de entorno antes de usar Supabase.');
    }

    this.supabaseClient = createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
      {
        auth: {
          // sessionStorage en vez de localStorage (por defecto): cada pestaña
          // queda con su propia sesión, así se puede tener un usuario distinto
          // por pestaña (por ejemplo, organizador en una y catador en otra).
          // Costo aceptado: la sesión no sobrevive a cerrar esa pestaña ni se
          // sincroniza entre pestañas (antes sí, con localStorage).
          storage: window.sessionStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
    return this.supabaseClient;
  }
}
