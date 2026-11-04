import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GUSTOS_PREDOMINANTES, GustoPredominante } from '../../../core/scanner/ficha-escaneada';

const ETIQUETAS: Readonly<Record<GustoPredominante, string>> = {
  salado: 'Salado',
  amargo: 'Amargo',
  acido: 'Ácido',
  umami: 'Umami',
  dulce: 'Dulce'
};

/**
 * "Gustos Predominantes (2)" de la hoja SCA (Combinado y Descriptivo).
 * Máximo 2: con dos marcados, el resto se deshabilita. Emite la lista completa
 * para que el formulario la guarde tal cual en su JSON (`gustosPredominantes`).
 */
@Component({
  selector: 'app-gustos-predominantes',
  standalone: true,
  templateUrl: './gustos-predominantes.component.html',
  styleUrls: ['./gustos-predominantes.component.scss']
})
export class GustosPredominantesComponent {
  @Input() seleccion: readonly string[] | null | undefined = [];
  @Input() deshabilitado = false;
  @Output() readonly seleccionChange = new EventEmitter<GustoPredominante[]>();

  readonly maximo = 2;
  readonly opciones = GUSTOS_PREDOMINANTES.map(clave => ({ clave, etiqueta: ETIQUETAS[clave] }));

  get actuales(): GustoPredominante[] {
    return (this.seleccion ?? []).filter((g): g is GustoPredominante =>
      (GUSTOS_PREDOMINANTES as readonly string[]).includes(g));
  }

  estaMarcado(clave: GustoPredominante): boolean {
    return this.actuales.includes(clave);
  }

  bloqueado(clave: GustoPredominante): boolean {
    return this.deshabilitado || (!this.estaMarcado(clave) && this.actuales.length >= this.maximo);
  }

  alternar(clave: GustoPredominante, evento: Event): void {
    const marcado = (evento.target as HTMLInputElement).checked;
    const actuales = this.actuales.filter(g => g !== clave);
    if (marcado && actuales.length >= this.maximo) {
      (evento.target as HTMLInputElement).checked = false; // defensa extra: nunca más de 2
      return;
    }
    this.seleccionChange.emit(marcado ? [...actuales, clave] : actuales);
  }
}
