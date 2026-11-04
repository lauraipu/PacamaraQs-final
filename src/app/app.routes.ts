import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { organizerGuard } from './core/guards/organizer.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * rol_global solo admite 'catador' | 'administrador' (CHECK en public.usuarios).
 * "Organizador" NO es un rol global: es una relación por sesión
 * (sesiones.organizador_id) y la valida organizerGuard.
 */
const ROLES_APP = ['catador'];
const ROLES_ADMIN = ['administrador'];

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/auth/registro/registro.page').then(m => m.RegistroPage)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard/dashboard.page').then(m => m.DashboardPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./pages/admin-dashboard/admin-dashboard.page').then(m => m.AdminDashboardPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_ADMIN }
  },
  {
    path: 'affective-form/:sesionId',
    loadComponent: () => import('./pages/evaluation/affective-form/affective-form.page').then(m => m.AffectiveFormPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'combined-form/:sesionId',
    loadComponent: () => import('./pages/evaluation/combined-form/combined-form.page').then(m => m.CombinedFormPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'descriptive-form/:sesionId',
    loadComponent: () => import('./pages/evaluation/descriptive-form/descriptive-form.page').then(m => m.DescriptiveFormPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'extrinsic-form/:sesionId',
    loadComponent: () => import('./pages/evaluation/extrinsic-form/extrinsic-form.page').then(m => m.ExtrinsicFormPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'session/create',
    loadComponent: () => import('./pages/session/create-session/create-session.page').then(m => m.CreateSessionPage),
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
    loadComponent: () => import('./pages/session/waiting-room/waiting-room.page').then(m => m.WaitingRoomPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'session/:id/organizer-dashboard',
    loadComponent: () => import('./pages/session/organizer-dashboard/organizer-dashboard.page').then(m => m.OrganizerDashboardPage),
    canActivate: [authGuard, roleGuard, organizerGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'session/:id/evaluation-complete',
    loadComponent: () => import('./pages/session/evaluation-complete/evaluation-complete.page').then(m => m.EvaluationCompletePage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'session/:id/results',
    loadComponent: () => import('./pages/session/results/results.page').then(m => m.ResultsPage),
    canActivate: [authGuard, roleGuard, organizerGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'waiting-room',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  { path: '**', redirectTo: 'login' }
];
