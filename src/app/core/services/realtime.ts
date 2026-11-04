import { effect, inject, Injectable, Signal, signal } from '@angular/core';
import { RealtimeChannel, REALTIME_SUBSCRIBE_STATES, SupabaseClient } from '@supabase/supabase-js';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth';
import { SesionService } from './sesion';
import { SupabaseService } from './supabase';

/** Tiempo que se espera a que un catador desconectado vuelva antes de retirarlo. */
export const GRACE_PERIOD_MS = 45_000;
/** Espera antes de cerrar un canal sin consumidores (cubre transiciones de página de Ionic). */
const RETARDO_CIERRE_CANAL_MS = 1_500;
/** Agrupa ráfagas de cambios de BD en una sola resincronización. */
const RETARDO_RESYNC_MS = 400;

export type RolEnSala = 'organizador' | 'catador';
export type EstadoConexion = 'conectando' | 'conectado' | 'reconectando' | 'desconectado';
export type EstadoPresencia = 'en_linea' | 'inestable';

export interface PresenciaUsuario {
  usuarioId: string;
  nombre: string;
  rol: RolEnSala;
  estado: EstadoPresencia;
  /** Epoch ms del último cambio de estado (inicio del Grace Period si es 'inestable'). */
  desde: number;
}

/** Eventos efímeros por Broadcast (+ RESYNC local para reconexiones / fallback BD). */
export type EventoSala =
  | { tipo: 'LISTO'; usuarioId: string; listo: boolean }
  | { tipo: 'INICIAR_CATA' }
  | { tipo: 'CAMBIAR_MUESTRA'; numeroMuestra: number }
  | { tipo: 'MUESTRA_CERRADA'; numeroMuestra: number }
  | { tipo: 'SESION_FINALIZADA' }
  | { tipo: 'PARTICIPANTE_RETIRADO'; usuarioId: string }
  | { tipo: 'EVALUACION_ENVIADA'; usuarioId: string; numeroMuestra: number }
  | { tipo: 'RESYNC'; motivo: 'reconexion' | 'cambio_bd' | 'red_restaurada' };

export type EventoBroadcast = Exclude<EventoSala, { tipo: 'RESYNC' }>;

export interface OpcionesSala {
  sesionId: string;
  usuarioId: string;
  nombre: string;
  rol: RolEnSala;
  gracePeriodMs?: number;
}

interface PayloadPresencia {
  usuarioId: string;
  nombre: string;
  rol: RolEnSala;
  conectadoEn: string;
}

const EVENTOS_BROADCAST: EventoBroadcast['tipo'][] = [
  'LISTO',
  'INICIAR_CATA',
  'CAMBIAR_MUESTRA',
  'MUESTRA_CERRADA',
  'SESION_FINALIZADA',
  'PARTICIPANTE_RETIRADO',
  'EVALUACION_ENVIADA'
];

/**
 * Conexión a la sala de una sesión: canal PRIVADO "sesion:<uuid>" con
 *  · Presence  → quién está conectado (+ Grace Period de 45 s al perder conexión).
 *  · Broadcast → eventos efímeros instantáneos (LISTO, INICIAR_CATA, ...).
 *  · Postgres Changes → SOLO como señal de resincronización (fallback), nunca
 *    como fuente de estado.
 *
 * Los broadcasts son "pistas": la autorización real está en las políticas de
 * realtime.messages y las páginas verifican contra la BD antes de actuar.
 */
export class SalaRealtime {
  private readonly _presencia = signal<ReadonlyMap<string, PresenciaUsuario>>(new Map());
  private readonly _estadoConexion = signal<EstadoConexion>('conectando');
  private readonly eventosSubject = new Subject<EventoSala>();

  readonly presencia: Signal<ReadonlyMap<string, PresenciaUsuario>> = this._presencia.asReadonly();
  readonly estadoConexion: Signal<EstadoConexion> = this._estadoConexion.asReadonly();
  readonly eventos$: Observable<EventoSala> = this.eventosSubject.asObservable();

  private canal: RealtimeChannel | null = null;
  private cerrada = false;
  private huboDesconexion = false;
  private readonly temporizadoresGracia = new Map<string, ReturnType<typeof setTimeout>>();
  private temporizadorResync?: ReturnType<typeof setTimeout>;
  private readonly gracePeriodMs: number;

  private readonly alPerderRed = () => {
    if (!this.cerrada) this._estadoConexion.set('reconectando');
  };
  private readonly alRecuperarRed = () => {
    if (!this.cerrada) this.emitir({ tipo: 'RESYNC', motivo: 'red_restaurada' });
  };

  constructor(
    private readonly cliente: SupabaseClient,
    private readonly sesionService: SesionService,
    readonly opciones: OpcionesSala
  ) {
    this.gracePeriodMs = opciones.gracePeriodMs ?? GRACE_PERIOD_MS;
  }

  get sesionId(): string {
    return this.opciones.sesionId;
  }

  async conectar(): Promise<void> {
    window.addEventListener('offline', this.alPerderRed);
    window.addEventListener('online', this.alRecuperarRed);

    try {
      // Los canales privados envían el JWT del usuario para evaluar las
      // políticas de realtime.messages.
      await this.cliente.realtime.setAuth();
    } catch (error) {
      console.warn('[Realtime] No se pudo propagar el token al socket:', error);
    }
    if (this.cerrada) return;

    const { sesionId, usuarioId } = this.opciones;
    const canal = this.cliente.channel(`sesion:${sesionId}`, {
      config: {
        private: true,
        broadcast: { self: false, ack: true },
        presence: { key: usuarioId, enabled: true }
      }
    });

    canal.on('presence', { event: 'sync' }, () => this.procesarPresencia());

    for (const evento of EVENTOS_BROADCAST) {
      canal.on('broadcast', { event: evento }, mensaje => {
        const parseado = this.parsearBroadcast(evento, mensaje['payload']);
        if (parseado) this.emitir(parseado);
      });
    }

    // Fallback: si se pierde un broadcast, el cambio en BD dispara un resync.
    canal.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'participantes', filter: `sesion_id=eq.${sesionId}` },
      () => this.programarResync()
    );
    canal.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sesiones', filter: `id=eq.${sesionId}` },
      () => this.programarResync()
    );

    this.canal = canal;
    canal.subscribe((estado, error) => {
      if (this.cerrada) return;

      switch (estado) {
        case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
          this._estadoConexion.set('conectado');
          void this.anunciarPresencia();
          if (this.huboDesconexion) {
            this.huboDesconexion = false;
            this.emitir({ tipo: 'RESYNC', motivo: 'reconexion' });
          }
          break;
        case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
        case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
          console.warn(`[Realtime] Canal sesion:${sesionId} → ${estado}`, error);
          this.huboDesconexion = true;
          this._estadoConexion.set('reconectando');
          break;
        case REALTIME_SUBSCRIBE_STATES.CLOSED:
          this.huboDesconexion = true;
          this._estadoConexion.set('desconectado');
          break;
      }
    });
  }

  /** Envía un evento efímero. Devuelve true si el servidor lo confirmó. */
  async enviar(evento: EventoBroadcast): Promise<boolean> {
    if (!this.canal || this.cerrada) return false;
    const { tipo, ...payload } = evento;

    try {
      if (this._estadoConexion() === 'conectado') {
        const respuesta = await this.canal.send({ type: 'broadcast', event: tipo, payload });
        return respuesta === 'ok';
      }
      const respuesta = await this.canal.httpSend(tipo, payload);
      return respuesta.success;
    } catch (error) {
      console.warn(`[Realtime] No se pudo enviar ${tipo}:`, error);
      return false;
    }
  }

  async cerrar(): Promise<void> {
    if (this.cerrada) return;
    this.cerrada = true;

    window.removeEventListener('offline', this.alPerderRed);
    window.removeEventListener('online', this.alRecuperarRed);
    clearTimeout(this.temporizadorResync);
    for (const temporizador of this.temporizadoresGracia.values()) clearTimeout(temporizador);
    this.temporizadoresGracia.clear();

    const canal = this.canal;
    this.canal = null;
    if (canal) {
      try {
        await canal.untrack();
      } catch {
        // El canal pudo cerrarse antes; untrack es best-effort.
      }
      await this.cliente.removeChannel(canal);
    }

    this._presencia.set(new Map());
    this._estadoConexion.set('desconectado');
    this.eventosSubject.complete();
  }

  private async anunciarPresencia(): Promise<void> {
    if (!this.canal) return;
    const payload: PayloadPresencia = {
      usuarioId: this.opciones.usuarioId,
      nombre: this.opciones.nombre,
      rol: this.opciones.rol,
      conectadoEn: new Date().toISOString()
    };
    const respuesta = await this.canal.track(payload);
    if (respuesta !== 'ok') console.warn('[Realtime] track() respondió:', respuesta);
  }

  /**
   * Se usa solo el evento 'sync' (estado consolidado) en vez de join/leave:
   * con varias pestañas del mismo usuario, un 'leave' de una pestaña no
   * significa que el usuario se haya ido.
   */
  private procesarPresencia(): void {
    if (!this.canal) return;
    const estado = this.canal.presenceState<PayloadPresencia>();
    const ahora = Date.now();
    const siguiente = new Map(this._presencia());

    for (const [clave, metas] of Object.entries(estado)) {
      const meta = metas[0];
      if (!meta) continue;
      this.cancelarGracia(clave);
      const previo = siguiente.get(clave);
      siguiente.set(clave, {
        usuarioId: clave,
        nombre: typeof meta.nombre === 'string' && meta.nombre ? meta.nombre : previo?.nombre ?? 'Catador',
        rol: meta.rol === 'organizador' ? 'organizador' : 'catador',
        estado: 'en_linea',
        desde: previo?.estado === 'en_linea' ? previo.desde : ahora
      });
    }

    for (const [clave, previo] of siguiente) {
      if (clave in estado || clave === this.opciones.usuarioId) continue;
      if (previo.estado === 'en_linea') {
        siguiente.set(clave, { ...previo, estado: 'inestable', desde: ahora });
        this.iniciarGracia(clave);
      }
    }

    this._presencia.set(siguiente);
  }

  private iniciarGracia(usuarioId: string): void {
    if (this.temporizadoresGracia.has(usuarioId)) return;
    const temporizador = setTimeout(() => {
      this.temporizadoresGracia.delete(usuarioId);
      void this.vencerGracia(usuarioId);
    }, this.gracePeriodMs);
    this.temporizadoresGracia.set(usuarioId, temporizador);
  }

  private cancelarGracia(usuarioId: string): void {
    const temporizador = this.temporizadoresGracia.get(usuarioId);
    if (temporizador) {
      clearTimeout(temporizador);
      this.temporizadoresGracia.delete(usuarioId);
    }
  }

  private async vencerGracia(usuarioId: string): Promise<void> {
    if (this.cerrada) return;
    const actual = this._presencia().get(usuarioId);
    if (!actual || actual.estado !== 'inestable') return;

    const siguiente = new Map(this._presencia());
    siguiente.delete(usuarioId);
    this._presencia.set(siguiente);

    // Solo el organizador ejecuta la expulsión: evita N llamadas simultáneas.
    if (this.opciones.rol !== 'organizador' || actual.rol === 'organizador') return;

    try {
      await this.sesionService.abandonarSesion(this.opciones.sesionId, usuarioId);
      this.emitir({ tipo: 'PARTICIPANTE_RETIRADO', usuarioId });
      await this.enviar({ tipo: 'PARTICIPANTE_RETIRADO', usuarioId });
    } catch (error) {
      // Sesión ya cerrada / catador ya retirado: no hay nada que hacer.
      console.warn(`[Realtime] No se retiró a ${usuarioId} tras el Grace Period:`, error);
    }
  }

  private programarResync(): void {
    clearTimeout(this.temporizadorResync);
    this.temporizadorResync = setTimeout(() => {
      this.emitir({ tipo: 'RESYNC', motivo: 'cambio_bd' });
    }, RETARDO_RESYNC_MS);
  }

  private emitir(evento: EventoSala): void {
    if (!this.cerrada) this.eventosSubject.next(evento);
  }

  private parsearBroadcast(tipo: EventoBroadcast['tipo'], payload: unknown): EventoBroadcast | null {
    const datos = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
    const texto = (clave: string) => (typeof datos[clave] === 'string' ? (datos[clave] as string) : '');
    const entero = (clave: string) => {
      const valor = Number(datos[clave]);
      return Number.isInteger(valor) && valor >= 1 ? valor : null;
    };

    switch (tipo) {
      case 'LISTO':
        return texto('usuarioId') ? { tipo, usuarioId: texto('usuarioId'), listo: datos['listo'] === true } : null;
      case 'INICIAR_CATA':
      case 'SESION_FINALIZADA':
        return { tipo };
      case 'CAMBIAR_MUESTRA':
      case 'MUESTRA_CERRADA': {
        const numeroMuestra = entero('numeroMuestra');
        return numeroMuestra ? { tipo, numeroMuestra } : null;
      }
      case 'PARTICIPANTE_RETIRADO':
        return texto('usuarioId') ? { tipo, usuarioId: texto('usuarioId') } : null;
      case 'EVALUACION_ENVIADA': {
        const numeroMuestra = entero('numeroMuestra');
        return texto('usuarioId') && numeroMuestra
          ? { tipo, usuarioId: texto('usuarioId'), numeroMuestra }
          : null;
      }
    }
  }
}

interface RegistroSala {
  sala: SalaRealtime;
  consumidores: number;
  cierrePendiente?: ReturnType<typeof setTimeout>;
}

/**
 * Registro de salas abiertas. Una sola conexión por sesión y por pestaña,
 * compartida por las páginas (sala de espera → formulario → completado) con
 * conteo de referencias. Así navegar entre páginas no genera un LEAVE de
 * Presence que dispararía el Grace Period.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly supabase = inject(SupabaseService);
  private readonly sesionService = inject(SesionService);
  private readonly authService = inject(AuthService);
  private readonly salas = new Map<string, RegistroSala>();

  constructor() {
    // Al cerrar sesión no deben quedar canales abiertos con el JWT anterior.
    effect(() => {
      if (!this.authService.usuario() && this.salas.size > 0) void this.cerrarTodas();
    });
  }

  abrirSala(opciones: OpcionesSala): SalaRealtime {
    const existente = this.salas.get(opciones.sesionId);
    if (existente && existente.sala.opciones.usuarioId === opciones.usuarioId) {
      clearTimeout(existente.cierrePendiente);
      existente.cierrePendiente = undefined;
      existente.consumidores++;
      return existente.sala;
    }
    if (existente) {
      // Cambio de usuario en la misma pestaña: la sala anterior ya no es válida.
      clearTimeout(existente.cierrePendiente);
      void existente.sala.cerrar();
      this.salas.delete(opciones.sesionId);
    }

    const sala = new SalaRealtime(this.supabase.client, this.sesionService, opciones);
    this.salas.set(opciones.sesionId, { sala, consumidores: 1 });
    void sala.conectar();
    return sala;
  }

  liberarSala(sala: SalaRealtime): void {
    const registro = this.salas.get(sala.sesionId);
    if (!registro || registro.sala !== sala) return;

    registro.consumidores = Math.max(0, registro.consumidores - 1);
    if (registro.consumidores > 0 || registro.cierrePendiente) return;

    registro.cierrePendiente = setTimeout(() => {
      if (registro.consumidores === 0 && this.salas.get(sala.sesionId) === registro) {
        this.salas.delete(sala.sesionId);
        void sala.cerrar();
      }
    }, RETARDO_CIERRE_CANAL_MS);
  }

  /** Cierra todas las salas (p. ej. al cerrar sesión). */
  async cerrarTodas(): Promise<void> {
    const registros = [...this.salas.values()];
    this.salas.clear();
    await Promise.all(registros.map(registro => {
      clearTimeout(registro.cierrePendiente);
      return registro.sala.cerrar();
    }));
  }
}
