// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  supabaseUrl: 'https://pjcvoqnsrifdvvuxaweb.supabase.co',
  supabaseKey: 'sb_publishable_eBj5zx2gt1HKpr9sQAw_VQ_NO7c6GTR',
  /**
   * Escáner de fichas: la IA se llama por la Edge Function `analizar-ficha`
   * (la llave de Gemini es el secreto GEMINI_API_KEY de Supabase, nunca va en la app).
   * true = respuestas simuladas, sin llamar a la IA (pruebas sin gastar cuota).
   */
  escanerSimulado: false
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
