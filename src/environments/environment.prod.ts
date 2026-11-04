export const environment = {
  production: true,
  supabaseUrl: 'https://pjcvoqnsrifdvvuxaweb.supabase.co',
  supabaseKey: 'sb_publishable_eBj5zx2gt1HKpr9sQAw_VQ_NO7c6GTR',
  /**
   * Escáner de fichas: la IA se llama por la Edge Function `analizar-ficha`
   * (la llave de Gemini es el secreto GEMINI_API_KEY de Supabase, nunca va en la app).
   * true = respuestas simuladas, sin llamar a la IA (pruebas sin gastar cuota).
   */
  escanerSimulado: false
};
