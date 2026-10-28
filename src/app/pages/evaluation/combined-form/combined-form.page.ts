import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  documentTextOutline,
  lockClosedOutline
} from 'ionicons/icons';
import { BaseCataForm } from '../../../core/cva/base-cata-form';
import {
  DESCRIPTORES_MOUTHFEEL,
  ETIQUETAS_HEDONICAS,
  RUEDA_SABORES,
  TIPOS_DEFECTO
} from '../../../core/cva/cva';

addIcons({
  arrowBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  documentTextOutline,
  lockClosedOutline
});

// --- INTERFACES Y TIPOS ---
export interface AtributoConDescriptores {
  intensidad: number;
  calidad: number;
  descriptores: string[];
  extra: string;
}
export interface AtributoSimple {
  intensidad: number;
  calidad: number;
}
export interface AtributosCombinado {
  fragancia: AtributoConDescriptores;
  aroma: AtributoConDescriptores;
  sabor: AtributoConDescriptores;
  saborResidual: AtributoConDescriptores;
  acidez: AtributoSimple;
  dulzor: AtributoSimple;
  sensacionEnBoca: AtributoSimple;
}
export interface FormularioCombinado {
  atributos: AtributosCombinado;
  impresionGlobal: number;
  mouthfeel: string[];
  notasMouthfeel: string;
  defectos: { tazasNoUniformes: number; tazasDefectuosas: number; };
  tiposDefecto: string[];
  notas: string;
}

export type AtributoCalificable =
  | 'fragancia'
  | 'aroma'
  | 'sabor'
  | 'saborResidual'
  | 'acidez'
  | 'dulzor'
  | 'sensacionEnBoca';

@Component({
  selector: 'app-combined-form',
  templateUrl: './combined-form.page.html',
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class CombinedFormPage extends BaseCataForm<FormularioCombinado> {

  // Variables de UI
  categoriasAbiertas: { [key: string]: boolean } = { 'Floral': true, 'Nueces / Cacao': true };
  ruedaKeys = Object.keys(RUEDA_SABORES);
  readonly ruedaSabores = RUEDA_SABORES;
  mouthfeelOptions = DESCRIPTORES_MOUTHFEEL;
  defectosOptions = TIPOS_DEFECTO;
  etiquetas = ETIQUETAS_HEDONICAS;

  private readonly alertCtrl = inject(AlertController);

  override formulario: FormularioCombinado = this.crearFormularioVacio();

  override crearFormularioVacio(): FormularioCombinado {
    return {
      atributos: {
        fragancia: { intensidad: 0, calidad: 0, descriptores: [], extra: '' },
        aroma: { intensidad: 0, calidad: 0, descriptores: [], extra: '' },
        sabor: { intensidad: 0, calidad: 0, descriptores: [], extra: '' },
        saborResidual: { intensidad: 0, calidad: 0, descriptores: [], extra: '' },
        acidez: { intensidad: 0, calidad: 0 },
        dulzor: { intensidad: 0, calidad: 0 },
        sensacionEnBoca: { intensidad: 0, calidad: 0 },
      },
      impresionGlobal: 0,
      mouthfeel: [],
      notasMouthfeel: '',
      defectos: { tazasNoUniformes: 0, tazasDefectuosas: 0 },
      tiposDefecto: [],
      notas: '',
    };
  }

  get puntaje(): number | null {
    const a = this.formulario.atributos;
    const calidades = [
      a.fragancia.calidad,
      a.aroma.calidad,
      a.sabor.calidad,
      a.saborResidual.calidad,
      a.acidez.calidad,
      a.dulzor.calidad,
      a.sensacionEnBoca.calidad,
      this.formulario.impresionGlobal
    ];
    if (calidades.some(calidad => calidad < 1 || calidad > 9)) return null;

    const sumaHedonicos = a.fragancia.calidad + a.aroma.calidad + a.sabor.calidad + 
                          a.saborResidual.calidad + a.acidez.calidad + a.dulzor.calidad + 
                          a.sensacionEnBoca.calidad + this.formulario.impresionGlobal;
    const penalizacion = (2 * this.formulario.defectos.tazasNoUniformes) + (4 * this.totalTazasDefectuosas);
    const calculo = (0.65625 * sumaHedonicos) + 52.75 - penalizacion;
    const redondeado = Math.round(calculo * 4) / 4;
    return Math.max(0, Math.min(100, redondeado));
  }

  get penalizacionTotal(): number {
    return (2 * this.formulario.defectos.tazasNoUniformes) + (4 * this.totalTazasDefectuosas);
  }

  get totalTazasDefectuosas(): number {
    return Math.max(
      this.formulario.defectos.tazasDefectuosas,
      this.formulario.tiposDefecto.length > 0 ? 1 : 0
    );
  }

  get clasificacion() {
    const p = this.puntaje;
    if (p === null) return { label: 'Pendiente', color: '#6c757d', bg: '#f8f9fa', border: '#dee2e6' };
    if (p >= 90) return { label: 'Excepcional', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
    if (p >= 85) return { label: 'Excelente', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
    if (p >= 80) return { label: 'Muy bueno', color: '#a16207', bg: '#fefce8', border: '#fef08a' };
    if (p >= 75) return { label: 'Bueno', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' };
    return { label: 'Regular', color: '#6c757d', bg: '#f8f9fa', border: '#dee2e6' };
  }

  // --- MÉTODOS DE INTERACCIÓN ---
  seleccionarCalidad(atributo: AtributoCalificable | 'impresionGlobal', valor: number): void {
    if (atributo === 'impresionGlobal') {
      this.formulario.impresionGlobal = valor;
    } else {
      this.formulario.atributos[atributo].calidad = valor;
    }
  }

  toggleCategoria(cat: string) {
    this.categoriasAbiertas[cat] = !this.categoriasAbiertas[cat];
  }

  toggleDescriptor(atributo: 'fragancia' | 'aroma' | 'sabor' | 'saborResidual', descriptor: string) {
    const lista = this.formulario.atributos[atributo].descriptores;
    if (lista.includes(descriptor)) {
      this.formulario.atributos[atributo].descriptores = lista.filter(d => d !== descriptor);
    } else {
      this.formulario.atributos[atributo].descriptores.push(descriptor);
    }
  }

  isDescriptorSelected(atributo: 'fragancia' | 'aroma' | 'sabor' | 'saborResidual', descriptor: string): boolean {
    return this.formulario.atributos[atributo].descriptores.includes(descriptor);
  }

  toggleMouthfeel(opcion: string) {
    if (this.formulario.mouthfeel.includes(opcion)) {
      this.formulario.mouthfeel = this.formulario.mouthfeel.filter(o => o !== opcion);
    } else {
      this.formulario.mouthfeel.push(opcion);
    }
  }

  toggleTipoDefecto(opcion: string) {
    if (this.formulario.tiposDefecto.includes(opcion)) {
      this.formulario.tiposDefecto = this.formulario.tiposDefecto.filter(o => o !== opcion);
    } else {
      this.formulario.tiposDefecto.push(opcion);
    }
  }

  ajustarDefecto(tipo: 'uniformes' | 'defectuosas', operacion: 'sumar' | 'restar') {
    if (tipo === 'uniformes') {
      let val = this.formulario.defectos.tazasNoUniformes;
      this.formulario.defectos.tazasNoUniformes = operacion === 'sumar' ? Math.min(5, val + 1) : Math.max(0, val - 1);
    } else {
      let val = this.formulario.defectos.tazasDefectuosas;
      this.formulario.defectos.tazasDefectuosas = operacion === 'sumar' ? Math.min(5, val + 1) : Math.max(0, val - 1);
    }
  }

  override async finalizarCata(): Promise<void> {
    const incompletas = this.respuestas.filter(respuesta => !this.esRespuestaCompleta(respuesta)).length;
    if (incompletas > 0) {
      const alert = await this.alertCtrl.create({
        header: 'Cata incompleta',
        message: `Aún tienes ${incompletas} muestra(s) sin calificar todos los atributos. Revisa todas las muestras antes de terminar.`,
        buttons: ['Entendido']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Finalizar cata',
      message: 'Las respuestas están completas, pero todavía no existe guardado en el servidor. Si sales, perderás esta evaluación.',
      buttons: [
        { text: 'Seguir evaluando', role: 'cancel' },
        {
          text: 'Salir sin guardar',
          role: 'destructive',
          handler: () => this.navCtrl.navigateRoot('/dashboard')
        }
      ]
    });
    await alert.present();
  }

  protected override esRespuestaCompleta(respuesta: FormularioCombinado): boolean {
    const atributos = respuesta.atributos;
    return ![
      atributos.fragancia.calidad,
      atributos.aroma.calidad,
      atributos.sabor.calidad,
      atributos.saborResidual.calidad,
      atributos.acidez.calidad,
      atributos.dulzor.calidad,
      atributos.sensacionEnBoca.calidad,
      respuesta.impresionGlobal
    ].some(calidad => !Number.isInteger(calidad) || calidad < 1 || calidad > 9);
  }

  protected override async mostrarAvisoCalificacionIncompleta(): Promise<void> {
    await this.mostrarToast('Por favor, califica todos los atributos de esta muestra antes de continuar.', 'warning');
  }
}
