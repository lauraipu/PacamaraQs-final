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
  totalMuestras: number;
  totalCatadores: number;
  muestras: SampleConsolidatedResult[];
  catadores: CupperResultSummary[];
}