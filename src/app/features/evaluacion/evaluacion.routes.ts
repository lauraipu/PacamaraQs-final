import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';
import { roleGuard } from '@core/auth/guards/role.guard';
import { salidaFormularioGuard } from '@core/auth/guards/salida-formulario.guard';
import { ROLES_APP } from '@core/auth/roles';

/**
 * Rutas de la feature evaluacion. Se montan en '' desde app.routes.ts: las URL
 * siguen siendo /combined-form/:sesionId, /affective-form/:sesionId, etc.
 * salidaFormularioGuard pide confirmación antes de salir con datos sin enviar.
 */
export const EVALUACION_ROUTES: Routes = [
  {
    path: 'affective-form/:sesionId',
    loadComponent: () => import('./pages/affective-form/affective-form.page').then(m => m.AffectiveFormPage),
    canActivate: [authGuard, roleGuard],
    canDeactivate: [salidaFormularioGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'combined-form/:sesionId',
    loadComponent: () => import('./pages/combined-form/combined-form.page').then(m => m.CombinedFormPage),
    canActivate: [authGuard, roleGuard],
    canDeactivate: [salidaFormularioGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'descriptive-form/:sesionId',
    loadComponent: () => import('./pages/descriptive-form/descriptive-form.page').then(m => m.DescriptiveFormPage),
    canActivate: [authGuard, roleGuard],
    canDeactivate: [salidaFormularioGuard],
    data: { roles: ROLES_APP }
  },
  {
    path: 'extrinsic-form/:sesionId',
    loadComponent: () => import('./pages/extrinsic-form/extrinsic-form.page').then(m => m.ExtrinsicFormPage),
    canActivate: [authGuard, roleGuard],
    canDeactivate: [salidaFormularioGuard],
    data: { roles: ROLES_APP }
  }
];
