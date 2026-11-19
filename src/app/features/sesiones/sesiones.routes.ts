import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';
import { organizerGuard } from '@core/auth/guards/organizer.guard';
import { roleGuard } from '@core/auth/guards/role.guard';
import { ROLES_APP } from '@core/auth/roles';

/**
 * Rutas de la feature sesiones. Se montan en '' desde app.routes.ts: las URL
 * siguen siendo /dashboard, /session/create, /session/waiting/:sesionId, etc.
 */
export const SESIONES_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'session/create',
    loadComponent: () => import('./pages/create-session/create-session.page').then(m => m.CreateSessionPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'create-session',
    redirectTo: 'session/create',
    pathMatch: 'full'
  },
  {
    path: 'session/waiting/:sesionId',
    loadComponent: () => import('./pages/waiting-room/waiting-room.page').then(m => m.WaitingRoomPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'session/:id/organizer-dashboard',
    loadComponent: () => import('./pages/organizer-dashboard/organizer-dashboard.page').then(m => m.OrganizerDashboardPage),
    canActivate: [authGuard, roleGuard, organizerGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'session/:id/evaluation-complete',
    loadComponent: () => import('./pages/evaluation-complete/evaluation-complete.page').then(m => m.EvaluationCompletePage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'waiting-room',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
