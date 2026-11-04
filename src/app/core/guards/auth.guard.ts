import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Exige un usuario autenticado con cuenta real (no anónima).
 * Lee el estado de AuthService (signals): sin peticiones de red por navegación.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    await authService.asegurarInicializado();
    if (authService.autenticado()) return true;

    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  } catch (error) {
    console.error('No se pudo validar la sesión autenticada:', error);
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url, authError: 'session' }
    });
  }
};
