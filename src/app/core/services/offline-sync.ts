import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { esErrorPermanente, mensajeDeError } from '../utils/errores';
import { AuthService } from './auth';
import { SupabaseService } from './supabase';

export interface EvaluacionAtributo {
  atributo: string;
  intensidad?: number;
  calidad?: number;
}

/** Ficha CVA de una muestra, lista para persistir en `evaluaciones` + `evaluacion_atributos`. */
export interface FichaEvaluacion {
  sesionId: string;
  catadorId: string;
  numeroMuestra: number;
  impresionGlobal: number | null;
  tazasNoUniformes: number;
  tazasDefectuosas: number;
  puntajeFinal: number | null;
  notas: string | null;
  atributos: EvaluacionAtributo[];
}

export type EstadoFicha = 'sincronizada' | 'pendiente' | 'rechazada';

export interface ResultadoEnvio {
  estado: EstadoFicha;
  mensaje?: string;
}

export interface ItemCola {
  clave: string;
  ficha: FichaEvaluacion;
  intentos: number;
  proximoIntentoEn: number;
  encoladaEn: number;
  ultimoError?: string;
}

interface BorradorGuardado<T> {
  usuarioId: string;
  actualizadoEn: number;
  datos: T;
}

type ResultadoIntento = 'ok' | 'reintentar' | 'rechazado';

const CLAVE_COLA = 'pacamara_cola_sync_v1';
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

/**
 * Las claves camelCase de los formularios se traducen a los valores del
 * CHECK de evaluacion_atributos.atributo.
 */
const ATRIBUTO_DB: Readonly<Record<string, string>> = {
  fragancia: 'fragancia',
  aroma: 'aroma',
  sabor: 'sabor',
  saborResidual: 'sabor_residual',
  sabor_residual: 'sabor_residual',
  acidez: 'acidez',
  dulzor: 'dulzor',
  sensacionEnBoca: 'sensacion_boca',
  sensacion_boca: 'sensacion_boca'
};

export function claveBorrador(sesionId: string, numeroMuestra: number): string {
  return `borrador_sesion_${sesionId}_${numeroMuestra}`;
}

function claveFicha(ficha: Pick<FichaEvaluacion, 'sesionId' | 'catadorId' | 'numeroMuestra'>): string {
  return `${ficha.sesionId}:${ficha.catadorId}:${ficha.numeroMuestra}`;
}

/**
 * Offline-first para fichas CVA.
 *  1. Borradores: cada cambio del formulario se guarda en localStorage bajo
 *     `borrador_sesion_{id}_{muestra}`.
 *  2. Envío: la ficha se encola (persistida) ANTES del primer intento; si la
 *     app se cierra a mitad de la petición, no se pierde.
 *  3. Reintentos: exponential backoff con jitter (2 s → 60 s), acelerado al
 *     volver la red o la app al primer plano.
 *  4. Idempotencia: UPSERT ON CONFLICT (sesion_id, catador_id, numero_muestra)
 *     y (evaluacion_id, atributo). Reenviar la misma ficha no duplica filas.
 */
@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly supabase = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  private readonly _enLinea = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  private readonly _cola = signal<readonly ItemCola[]>(this.leerColaPersistida());
  private readonly _rechazos = signal<ReadonlyMap<string, string>>(new Map());
  private readonly _sincronizando = signal(false);
  private readonly sincronizadasSubject = new Subject<FichaEvaluacion>();

  readonly enLinea = this._enLinea.asReadonly();
  readonly cola = this._cola.asReadonly();
  readonly rechazos = this._rechazos.asReadonly();
  readonly sincronizando = this._sincronizando.asReadonly();
  readonly cantidadPendientes = computed(() => this._cola().length);
  /** Emite cada ficha confirmada por el servidor (también las de la cola). */
  readonly sincronizadas$: Observable<FichaEvaluacion> = this.sincronizadasSubject.asObservable();

  private procesando = false;
  private temporizador?: ReturnType<typeof setTimeout>;
  /** Intentos en curso por clave: evita enviar dos veces la misma ficha a la vez. */
  private readonly enVuelo = new Map<string, Promise<ResultadoIntento>>();

  constructor() {
    const alConectar = () => {
      this._enLinea.set(true);
      this.adelantarReintentos();
    };
    const alDesconectar = () => this._enLinea.set(false);
    const alVolverPrimerPlano = () => {
      if (document.visibilityState === 'visible') this.adelantarReintentos();
    };

    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);
    document.addEventListener('visibilitychange', alVolverPrimerPlano);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
      document.removeEventListener('visibilitychange', alVolverPrimerPlano);
      clearTimeout(this.temporizador);
    });

    // Al restaurarse la sesión de Auth (arranque de la app) se vacía la cola.
    // Solo depende del usuario: si dependiera de la cola, cada encolado
    // dispararía un procesamiento paralelo al envío inmediato.
    effect(() => {
      const usuario = this.authService.usuario();
      if (usuario && untracked(() => this._cola().length) > 0) {
        queueMicrotask(() => void this.procesarCola());
      }
    });
  }

  /** Fichas pendientes de una sesión concreta. */
  pendientesDeSesion(sesionId: string): ItemCola[] {
    return this._cola().filter(item => item.ficha.sesionId === sesionId);
  }

  /**
   * Fichas que el servidor ya tiene del catador actual (RLS: solo las propias).
   * `notas` guarda el formulario serializado y permite retomar en otro dispositivo.
   */
  async obtenerFichasEnviadas(sesionId: string): Promise<{ numeroMuestra: number; notas: string | null }[]> {
    const usuarioId = this.authService.usuario()?.id;
    if (!usuarioId) return [];

    const { data, error } = await this.supabase.client
      .from('evaluaciones')
      .select('numero_muestra, notas')
      .eq('sesion_id', sesionId)
      .eq('catador_id', usuarioId);

    if (error) throw error;
    return (data ?? []).map(fila => ({
      numeroMuestra: Number(fila.numero_muestra),
      notas: typeof fila.notas === 'string' ? fila.notas : null
    }));
  }

  // ---------------------------------------------------------------------------
  // Borradores
  // ---------------------------------------------------------------------------

  guardarBorrador<T>(sesionId: string, numeroMuestra: number, datos: T): void {
    const usuarioId = this.authService.usuario()?.id;
    if (!usuarioId) return;

    const registro: BorradorGuardado<T> = { usuarioId, actualizadoEn: Date.now(), datos };
    try {
      localStorage.setItem(claveBorrador(sesionId, numeroMuestra), JSON.stringify(registro));
    } catch (error) {
      console.warn('[OfflineSync] No se pudo guardar el borrador:', error);
    }
  }

  /** Devuelve el borrador SOLO si pertenece al usuario actual (dispositivos compartidos). */
  leerBorrador<T>(sesionId: string, numeroMuestra: number): T | null {
    const usuarioId = this.authService.usuario()?.id;
    if (!usuarioId) return null;

    try {
      const crudo = localStorage.getItem(claveBorrador(sesionId, numeroMuestra));
      if (!crudo) return null;
      const registro = JSON.parse(crudo) as Partial<BorradorGuardado<T>>;
      return registro.usuarioId === usuarioId && registro.datos !== undefined ? registro.datos : null;
    } catch {
      return null;
    }
  }

  eliminarBorrador(sesionId: string, numeroMuestra: number): void {
    try {
      localStorage.removeItem(claveBorrador(sesionId, numeroMuestra));
    } catch {
      // Almacenamiento no disponible: no hay nada que borrar.
    }
  }

  // ---------------------------------------------------------------------------
  // Envío
  // ---------------------------------------------------------------------------

  /**
   * Encola la ficha y la intenta enviar de inmediato.
   * - 'sincronizada': confirmada por el servidor.
   * - 'pendiente': sin red o error transitorio; queda en cola con backoff.
   * - 'rechazada': el servidor la rechazó (p. ej. muestra cerrada). No se reintenta.
   */
  async enviar(ficha: FichaEvaluacion): Promise<ResultadoEnvio> {
    const clave = claveFicha(ficha);
    this.quitarRechazo(clave);
    this.ponerEnCola({ clave, ficha, intentos: 0, proximoIntentoEn: Date.now(), encoladaEn: Date.now() });

    if (!this._enLinea()) {
      return { estado: 'pendiente', mensaje: 'Guardado localmente. Reintentando…' };
    }

    // Si una versión anterior de esta misma ficha está en vuelo, se espera a
    // que termine para no pisar el resultado de la nueva.
    await this.enVuelo.get(clave)?.catch(() => undefined);

    const item = this._cola().find(i => i.clave === clave);
    if (!item) return { estado: 'sincronizada' };

    const resultado = await this.intentar(item);
    this.programarSiguiente();

    if (resultado === 'ok') return { estado: 'sincronizada' };
    if (resultado === 'rechazado') {
      return { estado: 'rechazada', mensaje: this._rechazos().get(clave) };
    }
    return { estado: 'pendiente', mensaje: 'Guardado localmente. Reintentando…' };
  }

  /** Fuerza un reintento inmediato de toda la cola (botón "Reintentar"). */
  reintentarAhora(): void {
    this.adelantarReintentos();
  }

  async procesarCola(): Promise<void> {
    if (this.procesando || !this._enLinea()) {
      this.programarSiguiente();
      return;
    }
    this.procesando = true;
    this._sincronizando.set(true);

    try {
      const ahora = Date.now();
      const vencidos = this._cola().filter(item => item.proximoIntentoEn <= ahora);
      for (const item of vencidos) {
        if (!this._enLinea()) break;
        const vigente = this._cola().find(i => i.clave === item.clave);
        if (vigente) await this.intentar(vigente);
      }
    } finally {
      this.procesando = false;
      this._sincronizando.set(false);
      this.programarSiguiente();
    }
  }

  private intentar(item: ItemCola): Promise<ResultadoIntento> {
    const existente = this.enVuelo.get(item.clave);
    if (existente) return existente;

    const intento = this.ejecutarIntento(item).finally(() => this.enVuelo.delete(item.clave));
    this.enVuelo.set(item.clave, intento);
    return intento;
  }

  private async ejecutarIntento(item: ItemCola): Promise<ResultadoIntento> {
    const usuarioId = this.authService.usuario()?.id;
    if (!usuarioId || usuarioId !== item.ficha.catadorId) {
      // La ficha es de otra cuenta o aún no se restauró la sesión: se retiene.
      this.reprogramar(item, 'Esperando la sesión del catador.');
      return 'reintentar';
    }

    try {
      await this.persistir(item.ficha);
      // Si mientras tanto se encoló una versión más nueva, esa sigue pendiente.
      const reemplazada = this._cola().some(i => i.clave === item.clave && i.encoladaEn !== item.encoladaEn);
      if (!reemplazada) {
        this.quitarDeCola(item.clave);
        this.eliminarBorrador(item.ficha.sesionId, item.ficha.numeroMuestra);
      }
      this.sincronizadasSubject.next(item.ficha);
      return 'ok';
    } catch (error) {
      if (esErrorPermanente(error)) {
        this.actualizarCola(cola => cola.filter(i => !(i.clave === item.clave && i.encoladaEn === item.encoladaEn)));
        this.registrarRechazo(item.clave, this.mensajeRechazo(error));
        return 'rechazado';
      }
      this.reprogramar(item, mensajeDeError(error, 'Error de red.'));
      return 'reintentar';
    }
  }

  /**
   * Ficha + atributos en UNA transacción (RPC registrar_evaluacion).
   * Antes eran dos escrituras: si esta ficha completaba el panel, el trigger
   * cerraba la sesión entre ambas y RLS rechazaba los atributos (le pasaba
   * siempre al último en enviar). El puntaje lo recalcula el servidor.
   */
  private async persistir(ficha: FichaEvaluacion): Promise<void> {
    const atributos = ficha.atributos
      .map(atributo => this.normalizarAtributo(atributo))
      .filter((fila): fila is NonNullable<typeof fila> => fila !== null);

    const { error } = await this.supabase.client.rpc('registrar_evaluacion', {
      p_sesion_id: ficha.sesionId,
      p_numero_muestra: ficha.numeroMuestra,
      p_ficha: {
        impresion_global: ficha.impresionGlobal,
        tazas_no_uniformes: ficha.tazasNoUniformes,
        tazas_defectuosas: ficha.tazasDefectuosas,
        atributos,
        notas: ficha.notas
      }
    });
    if (error) throw error;
  }

  private normalizarAtributo(
    atributo: EvaluacionAtributo
  ): { atributo: string; intensidad: number | null; calidad: number | null } | null {
    const nombreDb = ATRIBUTO_DB[atributo.atributo];
    if (!nombreDb) return null;

    const intensidad = this.enRango(atributo.intensidad, 0, 15);
    const calidad = this.enRango(atributo.calidad, 1, 9);
    if (intensidad === null && calidad === null) return null;
    return { atributo: nombreDb, intensidad, calidad };
  }

  private enRango(valor: number | undefined, min: number, max: number): number | null {
    return typeof valor === 'number' && Number.isFinite(valor) && valor >= min && valor <= max ? valor : null;
  }

  private mensajeRechazo(error: unknown): string {
    const texto = mensajeDeError(error, '');
    if (/row-level security/i.test(texto)) {
      return 'El servidor ya no acepta esta ficha: la muestra fue cerrada o la sesión terminó.';
    }
    return texto || 'El servidor rechazó la ficha.';
  }

  // ---------------------------------------------------------------------------
  // Cola y backoff
  // ---------------------------------------------------------------------------

  private calcularEspera(intentos: number): number {
    const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, intentos - 1));
    const jitter = base * 0.2 * (Math.random() * 2 - 1);
    return Math.round(base + jitter);
  }

  private reprogramar(item: ItemCola, mensaje: string): void {
    const intentos = item.intentos + 1;
    this.actualizarCola(cola => cola.map(i =>
      i.clave === item.clave
        ? { ...i, intentos, ultimoError: mensaje, proximoIntentoEn: Date.now() + this.calcularEspera(intentos) }
        : i
    ));
  }

  private adelantarReintentos(): void {
    const ahora = Date.now();
    this.actualizarCola(cola => cola.map(i => ({ ...i, proximoIntentoEn: Math.min(i.proximoIntentoEn, ahora) })));
    void this.procesarCola();
  }

  private programarSiguiente(): void {
    clearTimeout(this.temporizador);
    const cola = this._cola();
    if (cola.length === 0 || !this._enLinea()) return;

    const proximo = Math.min(...cola.map(i => i.proximoIntentoEn));
    const espera = Math.max(250, proximo - Date.now());
    this.temporizador = setTimeout(() => void this.procesarCola(), espera);
  }

  /** Una ficha nueva reemplaza a la pendiente de la misma (sesión, catador, muestra). */
  private ponerEnCola(item: ItemCola): void {
    this.actualizarCola(cola => [...cola.filter(i => i.clave !== item.clave), item]);
  }

  private quitarDeCola(clave: string): void {
    this.actualizarCola(cola => cola.filter(i => i.clave !== clave));
  }

  private actualizarCola(transformar: (cola: readonly ItemCola[]) => readonly ItemCola[]): void {
    const nueva = transformar(this._cola());
    this._cola.set(nueva);
    try {
      localStorage.setItem(CLAVE_COLA, JSON.stringify(nueva));
    } catch (error) {
      console.warn('[OfflineSync] No se pudo persistir la cola:', error);
    }
  }

  private registrarRechazo(clave: string, mensaje: string): void {
    const siguiente = new Map(this._rechazos());
    siguiente.set(clave, mensaje);
    this._rechazos.set(siguiente);
  }

  private quitarRechazo(clave: string): void {
    if (!this._rechazos().has(clave)) return;
    const siguiente = new Map(this._rechazos());
    siguiente.delete(clave);
    this._rechazos.set(siguiente);
  }

  private leerColaPersistida(): ItemCola[] {
    try {
      const crudo = localStorage.getItem(CLAVE_COLA);
      const lista = crudo ? (JSON.parse(crudo) as unknown) : [];
      if (!Array.isArray(lista)) return [];
      return lista.filter((item): item is ItemCola =>
        typeof item === 'object' && item !== null &&
        typeof (item as ItemCola).clave === 'string' &&
        typeof (item as ItemCola).ficha?.sesionId === 'string'
      );
    } catch {
      return [];
    }
  }
}
