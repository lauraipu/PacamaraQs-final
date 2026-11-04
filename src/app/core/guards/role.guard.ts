import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, RolGlobal } from '../services/auth';

/**
 * Valida public.usuarios.rol_global contra `data.roles` de la ruta.
 * Si el rol es válido pero la ruta no le corresponde, redirige a su inicio
 * (administrador → /admin-dashboard, catador → /dashboard).
 */
export const roleGuard: CanActivateFn = async route => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const rolesPermitidos = route.data['roles'] as RolGlobal[] | undefined;

  if (!rolesPermitidos?.length) {
    console.error('La ruta protegida no define roles permitidos.');
    return router.createUrlTree(['/login']);
  }

  try {
    await authService.asegurarInicializado();
    if (!authService.autenticado()) return router.createUrlTree(['/login']);

    const rol = await authService.obtenerRol();
    if (rolesPermitidos.includes(rol)) return true;

    return router.createUrlTree([authService.rutaInicioPorRol(rol)]);
  } catch (error) {
    console.error('No se pudo validar el rol del usuario:', error);
    return router.createUrlTree(['/login'], { queryParams: { authError: 'role' } });
  }
};
