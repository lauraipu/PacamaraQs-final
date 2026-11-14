import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { VERSION_POLITICA } from '../../../core/services/auth';

/** Resumen de la política de tratamiento de datos (Ley 1581 de 2012). Se reutiliza en registro y en la aceptación. */
@Component({
  selector: 'app-texto-politica',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <div class="texto-politica">
      <p>{{ 'politica.intro' | transloco }}</p>
      <ul>
        <li>{{ 'politica.responsable' | transloco }}</li>
        <li>{{ 'politica.datos' | transloco }}</li>
        <li>{{ 'politica.finalidad' | transloco }}</li>
        <li>{{ 'politica.derechos' | transloco }}</li>
      </ul>
      <p class="texto-politica__version">{{ 'politica.version' | transloco: { version: version } }}</p>
    </div>
  `,
  styles: [`
    .texto-politica { color: var(--app-text-main); font-size: 0.875rem; line-height: 1.5; }
    .texto-politica ul { margin: 12px 0; padding-left: 20px; }
    .texto-politica li { margin-bottom: 8px; }
    .texto-politica__version { color: var(--app-text-muted); font-size: 0.75rem; }
  `]
})
export class TextoPoliticaComponent {
  readonly version = VERSION_POLITICA;
}
