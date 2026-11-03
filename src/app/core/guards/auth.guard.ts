import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const { session } = await authService.getSession();
    return session && !session.user.is_anonymous
      ? true
      : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  } catch (error) {
    console.error('No se pudo validar la sesión autenticada:', error);
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url, authError: 'session' }
    });
  }
};
