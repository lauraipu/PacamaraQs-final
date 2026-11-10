import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { BaseCataForm } from '../../../core/cva/base-cata-form';
import { EstadoFichaComponent } from '../../../shared/components/estado-ficha/estado-ficha.component';
import { CARACTERES_NUMERICOS, formatearNumeroEs, parsearNumeroEs } from '../../../core/utils/numeros';
import { aTitulo, divisionDe, MONEDAS, PAISES_CAFE, regionesDe, TIPOS_PROCESO } from '../../../core/cva/origenes';
import { OpcionBuscable, SelectorBuscableComponent } from '../../../shared/components/selector-buscable/selector-buscable.component';

import { TranslocoPipe } from '@jsverse/transloco';
import { TrPipe } from '../../../core/i18n/tr';
/** Campos numéricos del bloque de comercio. */
type CampoNumerico = 'farmPrice' | 'lotSizeKg';

const LIMITES: Readonly<Record<CampoNumerico, { max: number; decimales: number }>> = {
  farmPrice: { max: 1_000_000_000, decimales: 2 },
  lotSizeKg: { max: 10_000_000, decimales: 1 }
};

addIcons({ arrowBackOutline });

interface FormularioExtrinseco {
  farming: {
    country: string;
    region: string;
    farmName: string;
    producers: string;
    species: string;
    variety: string;
    harvestDate: string;
    other: string;
  };
  processing: {
    processorName: string;
    wetMill: string;
    dryMill: string;
    processType: string;
    /** Método de descafeinado ('' = no aplica). */
    decaf: string;
    description: string;
    other: string;
  };
  trading: {
    importer: string;
    exporter: string;
    grade: string;
    icoNumber: string;
    /** Precio en finca. Solo el número (sin $ ni separadores). */
    farmPrice: number | null;
    /** Código ISO 4217 del precio (COP por defecto). */
    currency: string;
    /** Tamaño del lote en kg. */
    lotSizeKg: number | null;
    other: string;
  };
  certifications: {
    c4: boolean;
    fairTrade: boolean;
    organic: boolean;
    rainforest: boolean;
    other: string;
  };
  notes: string;
}

@Component({
  selector: 'app-extrinsic-form',
  templateUrl: './extrinsic-form.page.html',
  styleUrls: ['./extrinsic-form.page.scss'],
  standalone: true,
  imports: [TrPipe, TranslocoPipe, IonContent, IonIcon, CommonModule, FormsModule, EstadoFichaComponent, SelectorBuscableComponent]
})
export class ExtrinsicFormPage extends BaseCataForm<FormularioExtrinseco> {
  override formulario: FormularioExtrinseco = this.crearFormularioVacio();

  override crearFormularioVacio(): FormularioExtrinseco {
    return {
      farming: {
        country: '',
        region: '',
        farmName: '',
        producers: '',
        species: '',
        variety: '',
        harvestDate: '',
        other: ''
      },
      processing: {
        processorName: '',
        wetMill: '',
        dryMill: '',
        processType: '',
        decaf: '',
        description: '',
        other: ''
      },
      trading: { importer: '', exporter: '', grade: '', icoNumber: '', farmPrice: null, currency: 'COP', lotSizeKg: null, other: '' },
      certifications: {
        c4: false,
        fairTrade: false,
        organic: false,
        rainforest: false,
        other: ''
      },
      notes: ''
    };
  }

  /* ── Catálogos (país → región dinámica, moneda, proceso) ──────────────── */
  readonly opcionesPaises: OpcionBuscable[] = PAISES_CAFE.map(p => ({ valor: p.nombre, etiqueta: p.nombre }));
  readonly opcionesMonedas: OpcionBuscable[] = MONEDAS.map(m => ({ valor: m.codigo, etiqueta: m.codigo, detalle: m.nombre }));
  readonly tiposProceso = TIPOS_PROCESO;

  /** "Departamento" en Colombia, "Estado" en EE. UU./Brasil/México… */
  etiquetaRegion(): string {
    return divisionDe(this.formulario.farming.country);
  }

  opcionesRegiones(): OpcionBuscable[] {
    return regionesDe(this.formulario.farming.country).map(r => ({ valor: r, etiqueta: r }));
  }

  cambiarPais(pais: string): void {
    this.formulario.farming.country = pais;
    const regiones = regionesDe(pais);
    if (regiones.length > 0 && !regiones.includes(this.formulario.farming.region)) this.formulario.farming.region = '';
  }

  /** Nombres propios en Title Case, escriba como escriba el usuario. */
  normalizarNombres(): void {
    const { farming: f, processing: p, trading: t } = this.formulario;
    f.farmName = aTitulo(f.farmName ?? '');
    f.producers = aTitulo(f.producers ?? '');
    p.processorName = aTitulo(p.processorName ?? '');
    p.wetMill = aTitulo(p.wetMill ?? '');
    p.dryMill = aTitulo(p.dryMill ?? '');
    t.importer = aTitulo(t.importer ?? '');
    t.exporter = aTitulo(t.exporter ?? '');
  }

  /* ── Campos numéricos (precio y lote) ─────────────────────────────────
   * Inputs de texto con inputmode="decimal": `type="number"` deja escribir "e",
   * "+" y "-", ignora la coma decimal en Android y no permite mostrar
   * "25.000". Aquí se filtra cada pulsación, se avisa si hubo letras y se
   * guarda SOLO el número en el JSON; el formato COP es puramente visual.
   */
  readonly campoEnEdicion = signal<CampoNumerico | null>(null);
  readonly textoEnEdicion = signal('');
  readonly erroresNumericos = signal<Partial<Record<CampoNumerico, string>>>({});

  /** Texto que se muestra en el input: lo tecleado mientras se edita; el número formateado al salir. */
  textoCampo(campo: CampoNumerico): string {
    if (this.campoEnEdicion() === campo) return this.textoEnEdicion();
    return formatearNumeroEs(this.formulario.trading?.[campo], LIMITES[campo].decimales);
  }

  errorCampo(campo: CampoNumerico): string | null {
    return this.erroresNumericos()[campo] ?? null;
  }

  alEnfocarNumero(campo: CampoNumerico): void {
    this.campoEnEdicion.set(campo);
    this.textoEnEdicion.set(formatearNumeroEs(this.formulario.trading?.[campo], LIMITES[campo].decimales));
  }

  /** Bloquea letras desde el teclado físico (en móvil, `input` hace el filtro). */
  alPresionarTeclaNumero(campo: CampoNumerico, evento: KeyboardEvent): void {
    if (evento.ctrlKey || evento.metaKey || evento.key.length !== 1) return;
    if (!CARACTERES_NUMERICOS.test(evento.key)) {
      evento.preventDefault();
      this.ponerError(campo, 'Solo se permiten números (sin letras).');
    }
  }

  alEscribirNumero(campo: CampoNumerico, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const original = input.value;
    const limpio = [...original].filter(c => CARACTERES_NUMERICOS.test(c)).join('');
    if (limpio !== original) input.value = limpio; // quita letras pegadas o del teclado móvil
    this.textoEnEdicion.set(limpio);

    if (!limpio.trim()) {
      this.formulario.trading[campo] = null;
      this.ponerError(campo, limpio !== original ? 'Solo se permiten números (sin letras).' : null);
      return;
    }
    const valor = parsearNumeroEs(limpio);
    if (valor === null) {
      this.ponerError(campo, 'Formato no válido. Ej: 25.000 o 25000,50');
      return;
    }
    if (valor > LIMITES[campo].max) {
      this.ponerError(campo, 'El valor es demasiado alto.');
      return;
    }
    this.formulario.trading[campo] = valor;
    this.ponerError(campo, limpio !== original ? 'Solo se permiten números (sin letras).' : null);
  }

  alSalirNumero(campo: CampoNumerico): void {
    const valor = parsearNumeroEs(this.textoEnEdicion());
    if (this.textoEnEdicion().trim() && valor !== null && valor <= LIMITES[campo].max) this.ponerError(campo, null);
    this.campoEnEdicion.set(null);
  }

  /** "Siguiente" queda bloqueado mientras haya un número inválido en pantalla. */
  protected override esRespuestaCompleta(_respuesta: FormularioExtrinseco): boolean {
    this.normalizarNombres();
    this.formulario.trading.currency ||= 'COP';
    const errores = this.erroresNumericos();
    return !errores.farmPrice && !errores.lotSizeKg;
  }

  private ponerError(campo: CampoNumerico, mensaje: string | null): void {
    this.erroresNumericos.update(actual => ({ ...actual, [campo]: mensaje ?? undefined }));
  }
}
