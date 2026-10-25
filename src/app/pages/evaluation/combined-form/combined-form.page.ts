import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  documentTextOutline,
  lockClosedOutline
} from 'ionicons/icons';

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

// --- CONSTANTES ---
export const RUEDA_SABORES: Record<string, { color: string; subdescriptores: string[] }> = {
  'Floral': { color: '#F4B8C8', subdescriptores: ['Flor de té', 'Jazmín', 'Rosa', 'Lavanda'] },
  'Afrutado': { color: '#F4A636', subdescriptores: ['Bayas', 'Frutas deshidratadas', 'Cítricos', 'Fruta de hueso', 'Coco', 'Melón'] },
  'Ácido / Fermentado': { color: '#EDD84A', subdescriptores: ['Ácido acético', 'Fermentado', 'Vinoso', 'Agrio'] },
  'Verde / Vegetal': { color: '#72B74A', subdescriptores: ['Oliva', 'Pepino', 'Hierba', 'Heno', 'Crudo'] },
  'Otro': { color: '#A08060', subdescriptores: ['Químico', 'Humedad / Tierra', 'Madera', 'Papel / Mohoso'] },
  'Tostado': { color: '#7B4F2E', subdescriptores: ['Cereal', 'Quemado', 'Tabaco', 'Pipa'] },
  'Nueces / Cacao': { color: '#C47A30', subdescriptores: ['Nueces', 'Cacao', 'Chocolate', 'Almendra'] },
  'Especias': { color: '#E06040', subdescriptores: ['Anís', 'Pimienta', 'Canela', 'Clavo'] },
  'Dulce': { color: '#D49AB8', subdescriptores: ['Vainilla', 'Azúcar morena', 'Miel', 'Caramelo'] },
};

export const DESCRIPTORES_MOUTHFEEL = ['Áspero (arenoso, rugoso)', 'Aceitoso', 'Suave (aterciopelado, sedoso)', 'Astringente (deja seca la boca)', 'Metálico'];
export const TIPOS_DEFECTO = ['Mohoso / Terroso', 'Fenólico', 'Papa'];
export const ETIQUETAS_HEDONICAS: Record<number, string> = {
  1: 'Ext. baja', 2: 'Muy baja', 3: 'Mod. baja', 4: 'Lig. baja', 5: 'Neutro',
  6: 'Lig. alta', 7: 'Mod. alta', 8: 'Muy alta', 9: 'Ext. alta',
};

@Component({
  selector: 'app-combined-form',
  templateUrl: './combined-form.page.html',
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class CombinedFormPage {

  // Estado del formulario (Igual que tu formularioInicial)
  formulario: FormularioCombinado = {
    atributos: {
      fragancia: { intensidad: 8, calidad: 5, descriptores: [] },
      aroma: { intensidad: 8, calidad: 5, descriptores: [] },
      sabor: { intensidad: 8, calidad: 5, descriptores: [] },
      saborResidual: { intensidad: 8, calidad: 5, descriptores: [] },
      acidez: { intensidad: 8, calidad: 5 },
      dulzor: { intensidad: 8, calidad: 5 },
      sensacionEnBoca: { intensidad: 8, calidad: 5 },
    },
    impresionGlobal: 5,
    mouthfeel: [],
    notasMouthfeel: '',
    defectos: { tazasNoUniformes: 0, tazasDefectuosas: 0 },
    tiposDefecto: [],
    notas: '',
  };

  // Variables de UI
  categoriasAbiertas: { [key: string]: boolean } = { 'Floral': true, 'Nueces / Cacao': true };
  ruedaKeys = Object.keys(RUEDA_SABORES);
  readonly ruedaSabores = RUEDA_SABORES;
  mouthfeelOptions = DESCRIPTORES_MOUTHFEEL;
  defectosOptions = TIPOS_DEFECTO;
  etiquetas = ETIQUETAS_HEDONICAS;

  // Getters (Se recalculan automáticamente al cambiar algo en el formulario)
  get puntaje(): number {
    const a = this.formulario.atributos;
    const sumaHedonicos = a.fragancia.calidad + a.aroma.calidad + a.sabor.calidad + 
                          a.saborResidual.calidad + a.acidez.calidad + a.dulzor.calidad + 
                          a.sensacionEnBoca.calidad + this.formulario.impresionGlobal;
    const penalizacion = (2 * this.formulario.defectos.tazasNoUniformes) + (4 * this.formulario.defectos.tazasDefectuosas);
    const calculo = (0.65625 * sumaHedonicos) + 52.75 - penalizacion;
    return Math.max(0, Math.min(100, calculo));
  }

  get penalizacionTotal(): number {
    return (2 * this.formulario.defectos.tazasNoUniformes) + (4 * this.formulario.defectos.tazasDefectuosas);
  }

  get clasificacion() {
    const p = this.puntaje;
    if (p >= 90) return { label: 'Excepcional', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
    if (p >= 85) return { label: 'Excelente', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
    if (p >= 80) return { label: 'Muy bueno', color: '#a16207', bg: '#fefce8', border: '#fef08a' };
    if (p >= 75) return { label: 'Bueno', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' };
    return { label: 'Regular', color: '#6c757d', bg: '#f8f9fa', border: '#dee2e6' };
  }

  private readonly navCtrl = inject(NavController);

  // --- MÉTODOS DE INTERACCIÓN ---
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

  volver() {
    this.navCtrl.back();
  }
}
