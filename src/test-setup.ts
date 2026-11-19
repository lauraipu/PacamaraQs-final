import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ModalController } from '@ionic/angular';
import es from './assets/i18n/es.json';

// Polyfills for running unit tests under jsdom (the default Vitest environment).
// Ionic components such as ion-menu and ion-split-pane query `window.matchMedia`,
// which jsdom does not implement.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { es },
        preloadLangs: true,
        translocoConfig: {
          availableLangs: ['es'],
          defaultLang: 'es',
          fallbackLang: 'es'
        }
      })
    ],
    // GuiaService (providedIn: 'root') inyecta ModalController, que en la app
    // provee Ionic en main.ts. En jsdom la guía no se abre, basta un doble.
    providers: [{ provide: ModalController, useValue: { create: vi.fn() } }]
  });
});
