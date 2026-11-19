import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';
import { organizerGuard } from '@core/auth/guards/organizer.guard';
import { roleGuard } from '@core/auth/guards/role.guard';
import { ROLES_APP } from '@core/auth/roles';

/**
 * Rutas de la feature resultados, montadas en 'session/:id/results' desde
 * app.routes.ts. El hijo vacío hereda el parámetro :id (lo leen la página y
 * organizerGuard con route.paramMap).
 */
export const RESULTADOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/results/results.page').then(m => m.ResultsPage),
    canActivate: [authGuard, roleGuard, organizerGuard],
    data: { roles: ROLES_APP }
  }
];
