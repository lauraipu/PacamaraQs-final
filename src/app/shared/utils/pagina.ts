/** Una página de resultados de una consulta paginada. */
export interface Pagina<T> {
  total: number;
  filas: T[];
}
