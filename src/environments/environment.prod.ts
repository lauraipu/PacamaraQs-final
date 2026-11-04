export const environment = {
  production: true,
  supabaseUrl: 'https://pjcvoqnsrifdvvuxaweb.supabase.co',
  supabaseKey: 'sb_publishable_eBj5zx2gt1HKpr9sQAw_VQ_NO7c6GTR',
  /**
   * Llave de Google AI Studio para el escáner de fichas (Gemini).
   * Con 'PONER_LLAVE_AQUI' el ScannerService SIMULA la respuesta de la IA.
   * ⚠ Todo lo que esté en este archivo viaja dentro del bundle JavaScript y
   *   cualquiera puede leerlo. Úsala solo en desarrollo; en producción la
   *   llamada debe pasar por una Edge Function de Supabase con la llave como secreto.
   */
  geminiApiKey: 'PONER_LLAVE_AQUI',
  /** Modelo de Gemini (Gemini 1.5 ya no está disponible). */
  geminiModel: 'gemini-3.6-flash'
};
