/**
 * Textos con datos variables ({{p0}}…) generados en el código o enviados por el
 * servidor. `tr()` los reconoce aunque lleguen ya armados ("Muestra 3 no guardada").
 * Al agregar uno aquí, agregar también su traducción en assets/i18n (sección txt).
 */
export const PATRONES: readonly string[] = [
  'Muestra {{p0}} no guardada',
  'El organizador llevó el panel a la muestra {{p0}}.',
  'La muestra {{p0}} fue cerrada por el organizador.',
  'Descriptores: {{p0}}',
  'Otros defectos: {{p0}}',
  'Catador {{p0}}',
  'Formato de ficha no soportado: {{p0}}',
  '¿Eliminar “{{p0}}”? Esta acción no se puede deshacer.',
  'Aún tienes {{p0}} muestra(s) sin calificar todos los atributos. Revisa todas las muestras antes de terminar.',
  'No se pudo copiar el código. {{p0}}',
  'Panel guiado a la muestra {{p0}}.',
  'Cerrar muestra {{p0}}',
  'Hay {{p0}} catador(es) con fichas pendientes. Se cerrarán todas las muestras y no se aceptarán más envíos.',
  'Consolidado de {{p0}} ficha(s): {{p1}}.',
  'Excluidos por el organizador: {{p0}}.',
  'Muestra {{p0}}',
  'prom. {{p0}} → ',
  'Se unió hace {{p0}} min',
  'Se unió hace {{p0}} h',
  'Ficha guardada en la muestra {{p0}} de \"{{p1}}\".',
  'La IA no pudo leer {{p0}}. Por favor, agrégalos manualmente.',
  'Atributo desconocido: {{p0}}',
  'Formato CVA inválido: {{p0}}',
  'Se necesitan al menos 3 catadores listos para iniciar (hay {{p0}}).',
  'Transición de estado no permitida: {{p0}} → {{p1}}.',
  'Valores fuera de rango en {{p0}}.',
  '⚠ Ficha incompleta (sin atributos guardados): {{p0}}',
  '{{p0}} int.',
  '{{p0}} descriptores',
];
