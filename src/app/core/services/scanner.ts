import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  construirPrompt, extraerJson, FichaEscaneada, FormatoEscaneo, FORMATOS_ESCANEO, payloadFichaPersonal,
  respuestaSimulada, sanearFicha
} from '../scanner/ficha-escaneada';
import { AuthService } from './auth';
import { OfflineSyncService, ResultadoEnvio } from './offline-sync';
import { SupabaseService } from './supabase';

/** Valor de ejemplo del archivo de entorno: mientras esté así, se simula la IA. */
export const LLAVE_DE_EJEMPLO = 'PONER_LLAVE_AQUI';

const ENDPOINT_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIEMPO_MAXIMO_IA_MS = 60_000;
const LADO_MAXIMO_PX = 1600;
const TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024;

export interface ImagenPreparada {
  /** Base64 sin el prefijo `data:` (lo que espera Gemini en inline_data). */
  base64: string;
  mimeType: 'image/jpeg';
  /** Data URL para la vista previa. */
  vistaPrevia: string;
}

/**
 * Escáner de fichas en papel con IA (Gemini).
 *
 * ⚠ MODO SIMULADO: si `environment.geminiApiKey` es 'PONER_LLAVE_AQUI' (o está
 *   vacía), `analizarFicha()` NO llama a la IA: espera ~1 s y devuelve una ficha
 *   de ejemplo del formato elegido (marcada `simulada: true`). Sirve para probar
 *   todo el flujo —modal, revisión, guardado y resultados— sin gastar cuota.
 *
 * ⚠ SEGURIDAD: con una llave real, la petición sale desde el navegador y la
 *   llave queda dentro del bundle JS (cualquiera puede extraerla y gastar tu
 *   cuota). Úsalo así solo en desarrollo. Para producción, mueve
 *   `llamarGemini()` a una Edge Function de Supabase que lea la llave de sus
 *   secretos y exija un usuario autenticado; aquí solo cambiaría la URL.
 *
 * La respuesta de la IA nunca se guarda tal cual: `sanearFicha()` aplica los
 *   rangos SCA y el servidor vuelve a validar y recalcula el puntaje.
 */
@Injectable({ providedIn: 'root' })
export class ScannerService {
  private readonly supabase = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly offlineSync = inject(OfflineSyncService);

  /** true mientras no haya una llave real configurada. */
  get modoSimulado(): boolean {
    const llave = (environment.geminiApiKey ?? '').trim();
    return !llave || llave === LLAVE_DE_EJEMPLO;
  }

  /**
   * Envía la foto a la IA y devuelve la ficha ya saneada.
   * @param base64Image imagen en base64 (sin prefijo data:) — usar `prepararImagen()`.
   * @param formato 'combinado' | 'descriptivo' | 'afectivo' | 'extrinseca'
   */
  async analizarFicha(base64Image: string, formato: string): Promise<FichaEscaneada> {
    const formatoValido = FORMATOS_ESCANEO.find(f => f.id === formato)?.id;
    if (!formatoValido) throw new Error(`Formato de ficha no soportado: ${formato}`);
    if (!base64Image) throw new Error('No hay imagen para analizar.');

    // Sin llave → respuesta simulada (para pruebas).
    if (this.modoSimulado) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      return sanearFicha(respuestaSimulada(formatoValido), formatoValido, true);
    }

    const texto = await this.llamarGemini(base64Image, construirPrompt(formatoValido));
    return sanearFicha(extraerJson(texto), formatoValido, false);
  }

  /**
   * Muestra individual: crea la Sesión Personal (1 muestra, el usuario como
   * único catador), guarda la ficha y la cierra, todo en una transacción.
   * Devuelve el id de la sesión para abrir /session/:id/results.
   */
  async guardarComoSesionPersonal(ficha: FichaEscaneada, nombre?: string): Promise<string> {
    const { data, error } = await this.supabase.client.rpc('registrar_ficha_personal', {
      p_formato: ficha.formato,
      p_nombre: nombre?.trim() || null,
      p_ficha: payloadFichaPersonal(ficha)
    });
    if (error) throw error;
    if (typeof data !== 'string' || !data) throw new Error('El servidor no devolvió la sesión creada.');
    return data;
  }

  /**
   * Ficha de una sesión con panel en curso: se envía por la misma cola
   * offline-first que los formularios (RLS exige ser participante y que la
   * sesión esté en progreso; si la muestra ya tenía ficha, se actualiza).
   */
  async guardarEnSesion(ficha: FichaEscaneada, sesionId: string, numeroMuestra: number): Promise<ResultadoEnvio> {
    const usuarioId = this.authService.usuario()?.id;
    if (!usuarioId) throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
    return this.offlineSync.enviar({
      sesionId,
      catadorId: usuarioId,
      numeroMuestra,
      impresionGlobal: ficha.impresionGlobal,
      tazasNoUniformes: ficha.tazasNoUniformes,
      tazasDefectuosas: ficha.tazasDefectuosas,
      puntajeFinal: ficha.puntaje,
      notas: JSON.stringify(ficha.formulario),
      atributos: ficha.atributos
        .filter(a => a.intensidad !== null || a.calidad !== null)
        .map(a => ({
          atributo: a.atributo,
          ...(a.intensidad !== null ? { intensidad: a.intensidad } : {}),
          ...(a.calidad !== null ? { calidad: a.calidad } : {})
        }))
    });
  }

  /**
   * Lee la foto, la reduce a ≤ 1600 px y la recomprime en JPEG: una foto de
   * celular (4–12 MB) baja a ~300 KB, la petición es más rápida y barata y la
   * lectura de la IA no empeora.
   */
  async prepararImagen(archivo: File): Promise<ImagenPreparada> {
    if (!archivo.type.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen.');
    if (archivo.size > TAMANO_MAXIMO_BYTES) throw new Error('La imagen supera 15 MB.');

    const url = URL.createObjectURL(archivo);
    try {
      const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo leer la imagen (formato no soportado por el navegador).'));
        img.src = url;
      });
      const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(imagen.naturalWidth, imagen.naturalHeight));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(imagen.naturalWidth * escala);
      lienzo.height = Math.round(imagen.naturalHeight * escala);
      const ctx = lienzo.getContext('2d');
      if (!ctx) throw new Error('El navegador no permite procesar imágenes.');
      ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      const vistaPrevia = lienzo.toDataURL('image/jpeg', 0.85);
      return { base64: vistaPrevia.split(',')[1] ?? '', mimeType: 'image/jpeg', vistaPrevia };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Llamada REST a Gemini con salida JSON forzada. */
  private async llamarGemini(base64Image: string, prompt: string): Promise<string> {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_IA_MS);
    try {
      const respuesta = await fetch(`${ENDPOINT_GEMINI}/${encodeURIComponent(environment.geminiModel)}:generateContent`, {
        method: 'POST',
        signal: controlador.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': environment.geminiApiKey },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
            ]
          }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 }
        })
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        if (respuesta.status === 400 && /api key/i.test(detalle)) throw new Error('La llave de Gemini no es válida.');
        if (respuesta.status === 403) throw new Error('La llave de Gemini no tiene permiso para este modelo.');
        if (respuesta.status === 404) throw new Error(`El modelo "${environment.geminiModel}" no existe o ya no está disponible.`);
        if (respuesta.status === 429) throw new Error('Se agotó la cuota de Gemini. Intenta más tarde.');
        throw new Error(`Gemini respondió ${respuesta.status}.`);
      }

      const datos = await respuesta.json() as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      if (datos.promptFeedback?.blockReason) throw new Error('Gemini rechazó la imagen.');
      const texto = (datos.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
      if (!texto) throw new Error('Gemini no devolvió datos. Prueba con una foto más nítida.');
      return texto;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('La IA tardó demasiado en responder. Intenta de nuevo.');
      }
      throw error;
    } finally {
      clearTimeout(temporizador);
    }
  }
}
