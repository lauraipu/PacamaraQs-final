import { Routes } from '@angular/router';

/**
 * Raíz de la navegación: solo compone las features (cada una con su *.routes.ts).
 * Las URL no cambian: Supabase (correos de recuperación, OAuth), Vercel y el APK
 * dependen de ellas.
 *
 * Orden: primero las rutas con prefijo propio; después las features montadas en
 * '' (el router entra a cada una y, si ninguna de sus rutas coincide, sigue con
 * la siguiente); al final el comodín.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Con prefijo propio.
  {
    path: 'admin-dashboard',
    loadChildren: () => import('@features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  {
    // Panel de resultados del organizador.
    path: 'session/:id/results',
    loadChildren: () => import('@features/resultados/resultados.routes').then(m => m.RESULTADOS_ROUTES)
  },

  // Montadas en '' para conservar las URL históricas.
  {
    // /login, /registro, /verificar-dos-pasos, /recuperar, /nueva-contrasena, /aceptar-politica
    path: '',
    loadChildren: () => import('@features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    // /configuracion
    path: '',
    loadChildren: () => import('@features/perfil/perfil.routes').then(m => m.PERFIL_ROUTES)
  },
  {
    // /dashboard, /session/create, /session/waiting/:sesionId, /session/:id/organizer-dashboard, …
    path: '',
    loadChildren: () => import('@features/sesiones/sesiones.routes').then(m => m.SESIONES_ROUTES)
  },
  {
    // /combined-form/:sesionId, /affective-form/:sesionId, /descriptive-form/:sesionId, /extrinsic-form/:sesionId
    path: '',
    loadChildren: () => import('@features/evaluacion/evaluacion.routes').then(m => m.EVALUACION_ROUTES)
  },

  { path: '**', redirectTo: 'login' }
];
