import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { inject, isDevMode, provideAppInitializer, ErrorHandler } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { ActionSheetController, AlertController, IonicRouteStrategy, provideIonicAngular, ToastController } from '@ionic/angular';
import { provideTransloco } from '@jsverse/transloco';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { IDIOMAS, IdiomaService } from './app/core/i18n/idioma.service';
import { TranslocoHttpLoader } from './app/core/i18n/transloco-loader';
import {
  ActionSheetControllerTraducido, AlertControllerTraducido, ToastControllerTraducido
} from './app/core/i18n/overlays-traducidos';

import { ManejadorErrores } from './app/core/errores/manejador-errores';
import { CARGAR_MODAL_GUIA } from './app/core/guias/cargar-modal-guia';
bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    // Errores no capturados: aviso claro en vez de una app colgada.
    { provide: ErrorHandler, useClass: ManejadorErrores },
    // La guía vive en shared/; core/ solo recibe cómo cargarla (sin importar shared/).
    {
      provide: CARGAR_MODAL_GUIA,
      useValue: () => import('./app/shared/components/guia/guia-modal.component').then(m => m.GuiaModalComponent)
    },
    // Toasts, alertas y hojas de acción se traducen al idioma activo.
    { provide: ToastController, useClass: ToastControllerTraducido },
    { provide: AlertController, useClass: AlertControllerTraducido },
    { provide: ActionSheetController, useClass: ActionSheetControllerTraducido },
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: [...IDIOMAS],
        defaultLang: 'es',
        fallbackLang: 'es',
        missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
        reRenderOnLangChange: true,
        prodMode: !isDevMode()
      },
      loader: TranslocoHttpLoader
    }),
    provideAppInitializer(() => inject(IdiomaService).iniciar())
  ],
});
