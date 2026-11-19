import { Routes } from '@angular/router';
import { salidaFormularioGuard } from '@core/auth/guards/salida-formulario.guard';
import { authGuard } from '@core/auth/guards/auth.guard';
import { organizerGuard } from '@core/auth/guards/organizer.guard';
import { roleGuard } from '@core/auth/guards/role.guard';
import { ROLES_ADMIN, ROLES_APP } from '@core/auth/roles';

export const routes: Routes = [
  {
    // Feature auth: login, registro, 2FA, recuperar, nueva contraseña y política.
    // Montada en '' para conservar las URL (correos de Supabase, OAuth y APK).
    path: '',
    loadChildren: () => import('@features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard/dashboard.page').then(m => m.DashboardPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'configuracion',
    loadComponent: () => import('./pages/configuracion/configuracion.page').then(m => m.ConfiguracionPage),
    canActivate: [authGuard]
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./features/admin/pages/admin-panel.page').then(m => m.AdminPanelPage),
    canActivate: [authGuard, roleGuard],
    data: { roles: ROLES_ADMIN }
  },
  {
    path: 'affective-form/:sesionId',
    loadComponent: () => import('./pages/evaluation/affective-form/affective-form.page').then(m => m.AffectiveFormPage),
    canActivate: [authGuard, roleGuard],
    canDeactivate: [salidaFormularioGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'combined-form/:sesionId',
    loadComponent: () => import('./pages/evaluation/combined-form/combined-form.page').then(m => m.CombinedFormPage),
    canActivate: [authGuard, roleGuard],
    canDeactivate: [salidaFormularioGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'descriptive-form/:sesionId',
    loadComponent: () => import('./pages/evaluation/descriptive-form/descriptive-form.page').then(m => m.DescriptiveFormPage),
    canActivate: [authGuard, roleGuard],
    canDeactivate: [salidaFormularioGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'extrinsic-form/:sesionId',
    loadComponent: () => import('./pages/evaluation/extrinsic-form/extrinsic-form.page').then(m => m.ExtrinsicFormPage),
    canActivate: [authGuard, roleGuard],
    canDeactivate: [salidaFormularioGuard],
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
