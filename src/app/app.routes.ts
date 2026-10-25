import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

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
    canActivate: [authGuard]
  },
  {
    path: 'affective-form',
    loadComponent: () => import('./pages/evaluation/affective-form/affective-form.page').then( m => m.AffectiveFormPage)
  },
  {
    path: 'combined-form',
    loadComponent: () => import('./pages/evaluation/combined-form/combined-form.page').then( m => m.CombinedFormPage)
  },
  {
    path: 'descriptive-form',
    loadComponent: () => import('./pages/evaluation/descriptive-form/descriptive-form.page').then( m => m.DescriptiveFormPage)
  },
  {
    path: 'extrinsic-form',
    loadComponent: () => import('./pages/evaluation/extrinsic-form/extrinsic-form.page').then( m => m.ExtrinsicFormPage)
  },
  {
    path: 'session/create',
    loadComponent: () => import('./pages/session/create-session/create-session.page').then(m => m.CreateSessionPage),
    canActivate: [authGuard]
  },
  {
    path: 'create-session',
    redirectTo: 'session/create',
    pathMatch: 'full'
  },
  {
    path: 'session/waiting/:sesionId',
    loadComponent: () => import('./pages/session/waiting-room/waiting-room.page').then(m => m.WaitingRoomPage),
    canActivate: [authGuard]
  },
  {
    path: 'waiting-room',
    loadComponent: () => import('./pages/session/waiting-room/waiting-room.page').then(m => m.WaitingRoomPage),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  { path: '**', redirectTo: 'login' }
];
