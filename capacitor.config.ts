import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pacamaraqs.app',
  appName: 'PacamaraQs',
  // `ng build` deja el bundle en www/ (angular.json → outputPath.base = "www").
  webDir: 'www',
  android: {
    // Sin contenido http mezclado: Supabase y la Edge Function son https.
    allowMixedContent: false
  }
};

export default config;
