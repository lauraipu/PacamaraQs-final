import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ETIQUETAS_HEDONICAS } from '../../../core/cva/cva';
import {
  AtributoHoja, BOCA_SCA, circuloMarcado, DEFECTOS_SCA, DESCRIPTORES_SCA, etiquetaCalidad, GUSTOS_SCA, HojaSca
} from '../../../core/cva/hoja-sca';
import { FichaTecnica } from '../../../core/models/session-results.model';

/** Recuadro de notas de la hoja que corresponde a cada atributo. */
const NOTA_DE_ATRIBUTO: Readonly<Record<AtributoHoja, 'olfativo' | 'gustativo' | 'acidez' | 'dulzor' | 'boca'>> = {
  fragancia: 'olfativo', aroma: 'olfativo', sabor: 'gustativo', sabor_residual: 'gustativo',
  acidez: 'acidez', dulzor: 'dulzor', sensacion_boca: 'boca'
};

export type FormatoReporteSca = 'combinado' | 'descriptivo' | 'afectivo' | 'extrinseca';

const ETIQUETA_ATRIBUTO: Readonly<Record<AtributoHoja, string>> = {
  fragancia: 'Fragancia', aroma: 'Aroma', sabor: 'Sabor', sabor_residual: 'Sabor residual',
  acidez: 'Acidez', dulzor: 'Dulzor', sensacion_boca: 'Sensación en boca'
};

/**
 * Hoja oficial SCA (CVA v2, jun-2024) para los 4 formatos. Se renderiza oculta
 * y ImpresionService copia su HTML a un iframe con ESTILOS_HOJA_SCA, por eso
 * no tiene estilos propios ni encapsulamiento (clases sca-* planas).
 */
@Component({
  selector: 'app-sca-report-template',
  templateUrl: './sca-report-template.component.html',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule]
})
export class ScaReportTemplateComponent {
  @Input() formato: FormatoReporteSca | null = null;
  @Input() hoja: HojaSca | null = null;
  @Input() fichasTecnicas: readonly FichaTecnica[] = [];
  @Input() objetivo = '';
  @Input() fecha = '';

  readonly escala9 = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  readonly descriptoresSca = DESCRIPTORES_SCA;
  readonly gustosSca = GUSTOS_SCA;
  readonly bocaSca = BOCA_SCA;
  readonly defectosSca = DEFECTOS_SCA;
  readonly circuloMarcado = circuloMarcado;
  readonly etiquetaCalidad = etiquetaCalidad;
  readonly LEYENDA_HEDONICA = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ n, etiqueta: ETIQUETAS_HEDONICAS[n] ?? '' }));
  readonly atributosAfectivos = (Object.keys(ETIQUETA_ATRIBUTO) as AtributoHoja[])
    .map(clave => ({ clave, etiqueta: ETIQUETA_ATRIBUTO[clave] }));

  /** Texto de la columna afectiva: valor hedónico de cada atributo de la fila. */
  etiquetasAfectivas(hoja: HojaSca, atributos: readonly AtributoHoja[]): string {
    return atributos
      .map(a => {
        const valor = hoja.ficha.calidad[a];
        if (valor === null) return '';
        const prefijo = hoja.esPanel && !Number.isInteger(valor) ? `prom. ${valor.toFixed(2)} → ` : '';
        return `${ETIQUETA_ATRIBUTO[a]}: ${prefijo}${etiquetaCalidad(valor)}`;
      })
      .filter(Boolean)
      .join(' · ');
  }

  /** Casillas de certificación de la hoja SCA (mismas etiquetas que el mapper). */
  readonly certificacionesSca = ['4C', 'Fair Trade', 'Orgánico', 'Rainforest Alliance'] as const;

  otrasCertificaciones(lista: readonly string[]): string {
    return lista.filter(c => !(this.certificacionesSca as readonly string[]).includes(c)).join(', ');
  }

  /** Columna NOTAS del Afectivo: valor hedónico + nota escrita de ese atributo. */
  notaAfectiva(hoja: HojaSca, atributo: AtributoHoja): string {
    const campo = NOTA_DE_ATRIBUTO[atributo];
    return [this.etiquetasAfectivas(hoja, [atributo]), campo ? hoja.ficha.notas[campo] : ''].filter(Boolean).join(' · ');
  }

  /** Cajas de tazas (0–5) que se marcan: entero más cercano. */
  circuloMarcadoTazas(valor: number): number {
    return Math.min(5, Math.max(0, Math.round(valor)));
  }
}
