import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const roleGuard: CanActivateFn = async (route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = route.data['roles'] as string[] | undefined;

  if (!allowedRoles?.length) {
    console.error('La ruta protegida no define roles permitidos.');
    return router.createUrlTree(['/dashboard']);
  }

  try {
    const { user } = await authService.getUser();
    if (!user || user.is_anonymous) return router.createUrlTree(['/login']);

    const role = await authService.obtenerRolGlobal(user.id);
    if (allowedRoles.includes(role)) return true;

    if (role === 'administrador') return router.createUrlTree(['/admin-dashboard']);
    if (role === 'catador' || role === 'organizador') {
      return router.createUrlTree(['/dashboard']);
    }

    return router.createUrlTree(['/login'], {
      queryParams: { authError: 'role' }
    });
  } catch (error) {
    console.error('No se pudo validar el rol del usuario:', error);
    return router.createUrlTree(['/login'], {
      queryParams: { authError: 'role' }
    });
  }
};
