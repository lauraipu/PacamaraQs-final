export interface EvaluationDto {
  id: string;
  sesion_id: string;
  catador_id: string;
  numero_muestra: number;
  impresion_global?: number | null;
  tazas_no_uniformes?: number;
  tazas_defectuosas?: number;
  notas?: string | null;
  puntaje_final?: number | null;
}

export interface SampleDto {
  id: string;
  sesion_id: string;
  numero_muestra: number;
  nivel_tueste?: string | null;
}

export interface UsuarioDto {
  id: string;
  email: string;
  nombre: string;
  rol_global?: string;
  acepto_politica_en?: string | null;
  version_politica_aceptada?: string | null;
}
