/** Atributos CVA tal como los guarda el CHECK de evaluacion_atributos. */
export type AtributoCva =
  | 'fragancia' | 'aroma' | 'sabor' | 'sabor_residual' | 'acidez' | 'dulzor' | 'sensacion_boca';

export interface ValorAtributo {
  /** Intensidad física 0–15 (Descriptivo / Combinado). */
  intensidad: number | null;
  /** Calidad hedónica 1–9 (Afectivo / Combinado). */
  calidad: number | null;
}

export interface CupperResultSummary {
  cupperId: string;
  nombre: string;
  esOrganizador: boolean;
  muestrasEvaluadas: number;
  muestrasAsignadas: number;
  estado: 'pendiente' | 'enviado';
  submittedAt: string | null;
  puntajePromedio: number;
  desviacionRespectoPanel: number;
  puntajesPorMuestra: {
    numeroMuestra: number;
    puntaje: number;
    defectos: string[];
    tazasNoUniformes: number;
    tazasDefectuosas: number;
    /** Impresión Global 1–9 (null si el formato no la usa). */
    impresionGlobal: number | null;
    atributos: Partial<Record<string, ValorAtributo>>;
    /** JSON del formulario enviado (descriptores, notas, textura, defectos). */
    formulario: Record<string, unknown> | null;
  }[];
}

export interface SampleConsolidatedResult {
  numeroMuestra: number;
  nivelTueste: string | null;
  puntajePromedioPanel: number;
  puntajeMin: number;
  puntajeMax: number;
  desviacionEstandar: number;
  evaluacionesRecibidas: number;
  evaluacionesEsperadas: number;
  /** true si se aplicó Trimmed Mean (N ≥ 5: se descartan máx. y mín.). */
  recortado: boolean;
  puntajePromedioSimple: number;
  /** true si el organizador cerró la muestra con fichas pendientes. */
  cerradaForzada: boolean;
  atributosPromedio?: {
    fragancia: number;
    aroma: number;
    sabor: number;
    sabor_residual: number;
    acidez: number;
    dulzor: number;
    sensacion_boca: number;
  };
}

export interface SessionResults {
  sesionId: string;
  nombreSesion: string;
  formatoCva: string;
  fechaCierre: string;
  /** Sesión Personal (ficha escaneada): 1 catador, sin panel. */
  esPersonal?: boolean;
  totalMuestras: number;
  totalCatadores: number;
  muestras: SampleConsolidatedResult[];
  catadores: CupperResultSummary[];
  /** Promedios por muestra y atributo (intensidad 0–15 / calidad 1–9). */
  atributosPorMuestra: PromedioAtributo[];
  /** Distribución de la Impresión Global (1–9) por muestra. */
  votosHedonicos: VotoHedonico[];
  /** Solo formato extrínseco. */
  fichasTecnicas: FichaTecnica[];
}

export interface PromedioAtributo {
  numeroMuestra: number;
  atributo: string;
  respuestas: number;
  intensidadPromedio: number | null;
  calidadPromedio: number | null;
}

export interface VotoHedonico {
  numeroMuestra: number;
  valor: number;
  votos: number;
}

export interface FichaTecnicaCampo {
  etiqueta: string;
  valor: string;
}

export interface FichaTecnicaSeccion {
  titulo: string;
  campos: FichaTecnicaCampo[];
}

export interface FichaTecnica {
  numeroMuestra: number;
  registradaPor: string | null;
  registradaEn: string | null;
  secciones: FichaTecnicaSeccion[];
  certificaciones: string[];
  notas: string;
}
