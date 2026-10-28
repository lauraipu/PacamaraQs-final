import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';

export const organizerGuard: CanActivateFn = async (route) => {
  const supabase = inject(SupabaseService).client;
  const router = inject(Router);

  const sesionId = route.paramMap.get('id') || route.paramMap.get('sesionId');
  if (!sesionId) return router.createUrlTree(['/dashboard']);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.createUrlTree(['/login']);

    // Consultamos quién es el organizador de esta sesión
    const { data: sesion } = await supabase
      .from('sesiones')
      .select('organizador_id')
      .eq('id', sesionId)
      .single();

    if (sesion && sesion.organizador_id === user.id) {
      return true; // Es el organizador, puede pasar
    }

    // No es el organizador, lo mandamos a la pantalla de gracias
    return router.createUrlTree([`/session/${sesionId}/evaluation-complete`]);
  } catch {
    return router.createUrlTree(['/dashboard']);
  }
};