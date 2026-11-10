import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, chevronDownOutline, chevronForwardOutline } from 'ionicons/icons';
import { BaseCataForm } from '../../../core/cva/base-cata-form';
import { EstadoFichaComponent } from '../../../shared/components/estado-ficha/estado-ficha.component';
import { GustosPredominantesComponent } from '../../../shared/components/gustos-predominantes/gustos-predominantes.component';
import { RUEDA_SABORES } from '../../../core/cva/cva';

import { TranslocoPipe } from '@jsverse/transloco';
import { TrPipe } from '../../../core/i18n/tr';
addIcons({ arrowBackOutline, chevronDownOutline, chevronForwardOutline });

type AtributoAromatico = 'fragancia' | 'aroma' | 'sabor' | 'saborResidual';

interface AtributoConDescriptores {
  intensidad: number | null;
  descriptores: string[];
  extra: string;
}

interface FormularioDescriptivo {
  fragancia: AtributoConDescriptores;
  aroma: AtributoConDescriptores;
  sabor: AtributoConDescriptores;
  saborResidual: AtributoConDescriptores;
  acidez: { intensidad: number | null; nota: string };
  dulzor: { intensidad: number | null; nota: string };
  sensacionEnBoca: { intensidad: number | null; textura: string[] };
  /** Hoja SCA "Gustos Predominantes (2)": máximo 2 de salado/amargo/acido/umami/dulce. */
  gustosPredominantes: string[];
  notas: string;
}

@Component({
  selector: 'app-descriptive-form',
  templateUrl: './descriptive-form.page.html',
  standalone: true,
  imports: [TrPipe, TranslocoPipe, IonContent, IonIcon, CommonModule, FormsModule, EstadoFichaComponent, GustosPredominantesComponent]
})
export class DescriptiveFormPage extends BaseCataForm<FormularioDescriptivo> {
  override formulario: FormularioDescriptivo = this.crearFormularioVacio();

  readonly atributosAromaticos: { key: AtributoAromatico; label: string }[] = [
    { key: 'fragancia', label: 'Fragancia' },
    { key: 'aroma', label: 'Aroma (en taza)' },
    { key: 'sabor', label: 'Sabor' },
    { key: 'saborResidual', label: 'Sabor Residual' }
  ];
  readonly escalaIntensidad = { min: 0, max: 15, step: 0.5 };
  readonly ruedaKeys = Object.keys(RUEDA_SABORES);
  readonly ruedaSabores = RUEDA_SABORES;
  readonly texturas = ['Áspero', 'Aceitoso', 'Suave', 'Astringente', 'Metálico'];
  categoriasAbiertas: Record<string, boolean> = { Floral: true };

  override crearFormularioVacio(): FormularioDescriptivo {
    const atributoVacio = (): AtributoConDescriptores => ({ intensidad: null, descriptores: [], extra: '' });
    return {
      fragancia: atributoVacio(),
      aroma: atributoVacio(),
      sabor: atributoVacio(),
      saborResidual: atributoVacio(),
      acidez: { intensidad: null, nota: '' },
      dulzor: { intensidad: null, nota: '' },
      sensacionEnBoca: { intensidad: null, textura: [] },
      gustosPredominantes: [],
      notas: ''
    };
  }

  /** Guarda la selección (máx. 2) en el JSON del formulario. */
  cambiarGustos(gustos: string[]): void {
    this.formulario.gustosPredominantes = gustos.slice(0, 2);
  }

  toggleCategoria(categoria: string): void {
    this.categoriasAbiertas[categoria] = !this.categoriasAbiertas[categoria];
  }

  toggleDescriptor(atributo: AtributoAromatico, descriptor: string): void {
    const lista = this.formulario[atributo].descriptores;
    this.formulario[atributo].descriptores = lista.includes(descriptor)
      ? lista.filter(item => item !== descriptor)
      : [...lista, descriptor];
  }

  isDescriptorSelected(atributo: AtributoAromatico, descriptor: string): boolean {
    return this.formulario[atributo].descriptores.includes(descriptor);
  }

  toggleTextura(textura: string): void {
    const lista = this.formulario.sensacionEnBoca.textura;
    this.formulario.sensacionEnBoca.textura = lista.includes(textura)
      ? lista.filter(item => item !== textura)
      : [...lista, textura];
  }

}
