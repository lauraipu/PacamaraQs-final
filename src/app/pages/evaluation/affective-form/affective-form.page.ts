import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { BaseCataForm } from '../../../core/cva/base-cata-form';
import { ETIQUETAS_HEDONICAS } from '../../../core/cva/cva';

addIcons({ arrowBackOutline });

type AtributoHedonico =
  | 'fragancia'
  | 'aroma'
  | 'sabor'
  | 'saborResidual'
  | 'acidez'
  | 'dulzor'
  | 'sensacionEnBoca';

interface FormularioAfectivo extends Record<AtributoHedonico | 'impresionGlobal', number> {
  defectos: { tazasNoUniformes: number; tazasDefectuosas: number };
  notas: string;
}

@Component({
  selector: 'app-affective-form',
  templateUrl: './affective-form.page.html',
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class AffectiveFormPage extends BaseCataForm<FormularioAfectivo> {
  override formulario: FormularioAfectivo = this.crearFormularioVacio();

  readonly atributos: { key: AtributoHedonico; label: string }[] = [
    { key: 'fragancia', label: 'Fragancia' },
    { key: 'aroma', label: 'Aroma' },
    { key: 'sabor', label: 'Sabor' },
    { key: 'saborResidual', label: 'Sabor Residual (Posgusto)' },
    { key: 'acidez', label: 'Acidez' },
    { key: 'dulzor', label: 'Dulzor' },
    { key: 'sensacionEnBoca', label: 'Sensación en Boca' }
  ];
  readonly escalaHedonica = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  readonly etiquetas = ETIQUETAS_HEDONICAS;

  override crearFormularioVacio(): FormularioAfectivo {
    return {
      fragancia: 5,
      aroma: 5,
      sabor: 5,
      saborResidual: 5,
      acidez: 5,
      dulzor: 5,
      sensacionEnBoca: 5,
      impresionGlobal: 5,
      defectos: { tazasNoUniformes: 0, tazasDefectuosas: 0 },
      notas: ''
    };
  }

  protected override esRespuestaCompleta(respuesta: FormularioAfectivo): boolean {
    const valores = [
      respuesta.fragancia,
      respuesta.aroma,
      respuesta.sabor,
      respuesta.saborResidual,
      respuesta.acidez,
      respuesta.dulzor,
      respuesta.sensacionEnBoca,
      respuesta.impresionGlobal
    ];
    return valores.every(valor => Number.isInteger(valor) && valor >= 1 && valor <= 9);
  }

  get puntaje(): number {
    const f = this.formulario;
    const suma = f.fragancia + f.aroma + f.sabor + f.saborResidual + f.acidez +
      f.dulzor + f.sensacionEnBoca + f.impresionGlobal;
    const penalizacion = (2 * f.defectos.tazasNoUniformes) + (4 * f.defectos.tazasDefectuosas);
    const calculo = (0.65625 * suma) + 52.75 - penalizacion;
    return Math.max(0, Math.min(100, Math.round(calculo * 4) / 4));
  }

  protected override calcularPuntajeFinal(respuesta: FormularioAfectivo): number | null {
    const suma = respuesta.fragancia + respuesta.aroma + respuesta.sabor +
      respuesta.saborResidual + respuesta.acidez + respuesta.dulzor +
      respuesta.sensacionEnBoca + respuesta.impresionGlobal;
    const penalizacion = (2 * respuesta.defectos.tazasNoUniformes) +
      (4 * respuesta.defectos.tazasDefectuosas);
    const calculo = (0.65625 * suma) + 52.75 - penalizacion;
    return Math.max(0, Math.min(100, Math.round(calculo * 4) / 4));
  }

  get clasificacion() {
    const p = this.puntaje;
    if (p >= 90) return { label: 'Excepcional', color: '#15803d', bg: '#f0fdf4' };
    if (p >= 85) return { label: 'Excelente', color: '#1d4ed8', bg: '#eff6ff' };
    if (p >= 80) return { label: 'Muy bueno', color: '#a16207', bg: '#fefce8' };
    if (p >= 75) return { label: 'Bueno', color: '#c2410c', bg: '#fff7ed' };
    return { label: 'Regular', color: '#6c757d', bg: '#f8f9fa' };
  }

  ajustarDefecto(tipo: 'uniformes' | 'defectuosas', operacion: 'sumar' | 'restar'): void {
    const propiedad = tipo === 'uniformes' ? 'tazasNoUniformes' : 'tazasDefectuosas';
    const valorActual = this.formulario.defectos[propiedad];
    this.formulario.defectos[propiedad] = operacion === 'sumar'
      ? Math.min(5, valorActual + 1)
      : Math.max(0, valorActual - 1);
  }

}
