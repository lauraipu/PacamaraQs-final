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
    if (authService.autenticado()) {
      // Ley 1581: sin la política aceptada (versión vigente) no se usa la app.
      if (state.url.startsWith('/aceptar-politica')) return true;
      try {
        if (await authService.requierePolitica()) {
          return router.createUrlTree(['/aceptar-politica'], { queryParams: { returnUrl: state.url } });
        }
      } catch (error) {
        // Sin rol legible: roleGuard muestra el error correspondiente.
        console.error('No se pudo verificar la política aceptada:', error);
      }
      return true;
    }

    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  } catch (error) {
    console.error('No se pudo validar la sesión autenticada:', error);
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url, authError: 'session' }
    });
  }
};
