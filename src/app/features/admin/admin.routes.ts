import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';
import { roleGuard } from '@core/auth/guards/role.guard';
import { ROLES_ADMIN } from '@core/auth/roles';

/**
 * Rutas de la feature admin, montadas en 'admin-dashboard' desde app.routes.ts.
 * roleGuard exige rol administrador y verificación en dos pasos; además cada
 * RPC admin_* lo vuelve a validar en el servidor con es_admin().
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/admin-panel.page').then(m => m.AdminPanelPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_ADMIN }
  }
];
