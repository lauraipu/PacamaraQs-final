import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  extraerJson, FichaEscaneada, FORMATOS_ESCANEO, payloadFichaPersonal, respuestaSimulada, sanearFicha
} from '../scanner/ficha-escaneada';
import { AuthService } from './auth';
import { OfflineSyncService, ResultadoEnvio } from './offline-sync';
import { SupabaseService } from './supabase';

/** Edge Function de Supabase que guarda la llave de Gemini y arma el prompt. */
const FUNCION_IA = 'analizar-ficha';
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
 * La IA se llama SIEMPRE a través de la Edge Function `analizar-ficha`:
 *  · La llave de Gemini es el secreto GEMINI_API_KEY de Supabase; nunca viaja
 *    en el bundle ni en el APK (antes estaba en environment.ts y cualquiera
 *    podía extraerla del JavaScript compilado).
 *  · La función exige un usuario autenticado y arma el prompt en el servidor
 *    según el formato, así que no sirve como proxy abierto hacia Gemini.
 *
 * MODO SIMULADO: con `environment.escanerSimulado = true`, `analizarFicha()`
 *   no llama a la IA y devuelve una ficha de ejemplo (`simulada: true`).
 *
 * La respuesta nunca se guarda tal cual: `sanearFicha()` aplica los rangos
 *   SCA y el servidor vuelve a validar y recalcula el puntaje.
 */
@Injectable({ providedIn: 'root' })
export class ScannerService {
  private readonly supabase = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly offlineSync = inject(OfflineSyncService);

  /** true = respuestas simuladas, sin llamar a la IA. */
  get modoSimulado(): boolean {
    return environment.escanerSimulado === true;
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

    // Modo simulado (pruebas sin gastar cuota).
    if (this.modoSimulado) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      return sanearFicha(respuestaSimulada(formatoValido), formatoValido, true);
    }

    const texto = await this.llamarIa(base64Image, formatoValido);
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

  /** Llama a la Edge Function (que llama a Gemini con la llave del servidor). */
  private async llamarIa(base64Image: string, formato: string): Promise<string> {
    const { data, error } = await this.supabase.client.functions.invoke<{ texto?: string; error?: string }>(FUNCION_IA, {
      body: { formato, imagenBase64: base64Image }
    });
    if (error) {
      // FunctionsHttpError trae la respuesta: se usa el mensaje en español de la función.
      const contexto = (error as { context?: Response }).context;
      const cuerpo = contexto && typeof contexto.json === 'function'
        ? await contexto.json().catch(() => null) as { error?: string } | null
        : null;
      throw new Error(cuerpo?.error ?? 'No se pudo contactar al servicio de IA. Revisa tu conexión.');
    }
    const texto = data?.texto?.trim();
    if (!texto) throw new Error(data?.error ?? 'La IA no devolvió datos.');
    return texto;
  }
}
