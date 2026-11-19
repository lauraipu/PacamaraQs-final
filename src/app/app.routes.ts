import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';
import { roleGuard } from '@core/auth/guards/role.guard';
import { ROLES_ADMIN } from '@core/auth/roles';

export const routes: Routes = [
  {
    // Feature auth: login, registro, 2FA, recuperar, nueva contraseña y política.
    // Montada en '' para conservar las URL (correos de Supabase, OAuth y APK).
    path: '',
    loadChildren: () => import('@features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    // Feature sesiones: inicio, crear, sala de espera, panel del organizador y fin de la cata.
    path: '',
    loadChildren: () => import('@features/sesiones/sesiones.routes').then(m => m.SESIONES_ROUTES)
  },
  {
    // Feature perfil: Configuración (/configuracion).
    path: '',
    loadChildren: () => import('@features/perfil/perfil.routes').then(m => m.PERFIL_ROUTES)
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./features/admin/pages/admin-panel.page').then(m => m.AdminPanelPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_ADMIN }
  },
  {
    // Feature evaluacion: los 4 formularios CVA (combinado, afectivo, descriptivo, extrínseco).
    path: '',
    loadChildren: () => import('@features/evaluacion/evaluacion.routes').then(m => m.EVALUACION_ROUTES)
  },
  {
    // Feature resultados: panel de resultados del organizador (/session/:id/results).
    path: 'session/:id/results',
    loadChildren: () => import('@features/resultados/resultados.routes').then(m => m.RESULTADOS_ROUTES)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  { path: '**', redirectTo: 'login' }
];
