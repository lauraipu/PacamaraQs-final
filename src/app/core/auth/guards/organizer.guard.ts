import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionesRepository } from '../../data-access/sesiones/sesiones.repository';
import { AuthService } from '../auth.service';

/** Solo el organizador de la sesión pasa; los demás van a la pantalla de gracias. */
export const organizerGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const sesiones = inject(SesionesRepository);
  const router = inject(Router);

  const sesionId = route.paramMap.get('id') || route.paramMap.get('sesionId');
  if (!sesionId) return router.createUrlTree(['/dashboard']);

  try {
    const { user } = await auth.getUser();
    if (!user) return router.createUrlTree(['/login']);

    // Un error de consulta cuenta como "no es el organizador", igual que antes.
    const esOrganizador = await sesiones.esOrganizadorDeSesion(sesionId, user.id).catch(() => false);
    if (esOrganizador) return true;

    // No es el organizador, lo mandamos a la pantalla de gracias
    return router.createUrlTree([`/session/${sesionId}/evaluation-complete`]);
  } catch {
    return router.createUrlTree(['/dashboard']);
  }
};
