import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { inject, isDevMode, provideAppInitializer } from '@angular/core';
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

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
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
