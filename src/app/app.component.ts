import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { BotonAtrasService } from './core/navegacion/boton-atras.service';

import { BannerConexionComponent } from './shared/components/banner-conexion/banner-conexion.component';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, BannerConexionComponent],
})
export class AppComponent {
  constructor() {
    inject(BotonAtrasService).iniciar();
  }
}
