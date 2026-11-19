import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';

/**
 * Rutas de la feature auth. Se montan en '' desde app.routes.ts, así que las
 * URL siguen siendo /login, /registro, /recuperar, /nueva-contrasena, etc.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro.page').then(m => m.RegistroPage)
  },
  {
    // Segundo paso del inicio de sesión. Sin guard: authGuard redirige aquí.
    path: 'verificar-dos-pasos',
    loadComponent: () => import('./pages/verificar-dos-pasos/verificar-dos-pasos.page').then(m => m.VerificarDosPasosPage)
  },
  {
    path: 'recuperar',
    loadComponent: () => import('./pages/recuperar/recuperar.page').then(m => m.RecuperarPage)
  },
  {
    // Destino del enlace del correo de recuperación: sin guard, la sesión
    // de recuperación la crea Supabase al cargar la página.
    path: 'nueva-contrasena',
    loadComponent: () => import('./pages/nueva-contrasena/nueva-contrasena.page').then(m => m.NuevaContrasenaPage)
  },
  {
    // Aceptación obligatoria de la política de datos (p. ej. primer ingreso con Google).
    path: 'aceptar-politica',
    loadComponent: () => import('./pages/aceptar-politica/aceptar-politica.page').then(m => m.AceptarPoliticaPage),
    canActivate: [authGuard]
  }
];
