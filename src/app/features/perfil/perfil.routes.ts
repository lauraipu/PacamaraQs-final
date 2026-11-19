import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';

/** Rutas de la feature perfil. Se montan en '' desde app.routes.ts: la URL sigue siendo /configuracion. */
export const PERFIL_ROUTES: Routes = [
  {
    path: 'configuracion',
    loadComponent: () => import('./pages/configuracion/configuracion.page').then(m => m.ConfiguracionPage),
    canActivate: [authGuard]
  }
];
