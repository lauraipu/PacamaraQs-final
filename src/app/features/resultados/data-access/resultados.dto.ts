/**
 * DTO de resultados: forma EXACTA de lo que devuelve Supabase (snake_case).
 * Solo los conocen el repositorio y el mapper de esta feature.
 */

/** Ficha extrínseca serializada en evaluaciones.notas (formulario de ExtrinsicFormPage). */
export interface FichaExtrinsecaDto {
  numero_muestra: number;
  nombre: string | null;
  registrado_en: string | null;
  formulario: Record<string, unknown> | null;
}

/** Fila de evaluacion_extrinseca (sin ids) + nombres de certificaciones. */
export interface ExtrinsecaRegistradaDto {
  numero_muestra: number;
  datos: Record<string, unknown> | null;
  certificaciones: string[] | null;
}

/** Forma real (snake_case) que devuelve la RPC get_resumen_panel. */
export interface ResumenPanelDto {
  por_muestra: {
    numero_muestra: number;
    nivel_tueste: string | null;
    evaluaciones_recibidas: number;
    evaluaciones_esperadas: number;
    recortado: boolean;
    cerrada_forzada: boolean;
    puntaje_promedio_panel: number | null;
    puntaje_promedio_simple: number | null;
    puntaje_min: number | null;
    puntaje_max: number | null;
    desviacion_estandar: number | null;
  }[];
  por_catador: {
    cupper_id: string;
    nombre: string;
    es_organizador: boolean;
    muestras_evaluadas: number;
    muestras_asignadas: number;
    estado: 'pendiente' | 'enviado';
    submitted_at: string | null;
    puntaje_promedio: number | null;
    desviacion_respecto_panel: number | null;
    puntajes_por_muestra: {
      numero_muestra: number;
      puntaje: number | null;
      tazas_no_uniformes: number;
      tazas_defectuosas: number;
      impresion_global?: number | null;
      atributos?: Record<string, { intensidad: number | null; calidad: number | null }> | null;
      formulario?: Record<string, unknown> | null;
    }[];
  }[];
  /* Claves agregadas en la migración 20261104150000_resultados_por_formato. */
  por_atributo?: {
    numero_muestra: number;
    atributo: string;
    respuestas: number;
    intensidad_promedio: number | null;
    calidad_promedio: number | null;
  }[];
  votos_hedonicos?: { numero_muestra: number; valor: number; votos: number }[];
  fichas_extrinsecas?: FichaExtrinsecaDto[];
  extrinseca_registrada?: ExtrinsecaRegistradaDto[];
}
