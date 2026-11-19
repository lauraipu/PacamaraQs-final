import { computed, inject, Injectable, Injector, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase';
import { VERSION_POLITICA } from '@domain/politica/politica';

/** Deep link de regreso del OAuth en la APK (Supabase → Redirect URLs + AndroidManifest). */
export const REDIRECCION_NATIVA = 'com.pacamaraqs.app://auth/callback';
export type ErrorOAuth = 'cancelado' | 'error';

export type RolGlobal = 'catador' | 'administrador';

export interface UsuarioActual {
  id: string;
  email: string;
  nombre: string;
}

/** Pantalla del segundo paso del inicio de sesión (código de la app de autenticación). */
export const RUTA_DOS_PASOS = '/verificar-dos-pasos';

/** Ruta a la que llega el enlace del correo de recuperación de contraseña. */
export const RUTA_NUEVA_CONTRASENA = '/nueva-contrasena';

/**
 * El enlace del correo de recuperación llega con `type=recovery` en la URL.
 * Se lee al cargar este archivo (antes de crear el cliente de Supabase, que
 * borra los tokens de la URL) para obligar a terminar el cambio de contraseña
 * antes de entrar a la app, aunque Supabase devuelva a la raíz del sitio.
 */
const RECUPERACION_EN_URL = typeof window !== 'undefined'
  && /(^|[#?&])type=recovery(&|$)/.test(`${window.location.hash}&${window.location.search}`);
const MARCA_RECUPERACION = 'pacamaraqs.recuperacion';

function leerMarcaRecuperacion(): boolean {
  try { return sessionStorage.getItem(MARCA_RECUPERACION) === '1'; } catch { return false; }
}

/**
 * Estado global de autenticación con Signals (app zoneless).
 * - `usuario` y `rol` son la fuente de verdad para guards y páginas.
 * - El rol se lee de public.usuarios.rol_global (política RLS
 *   usuarios_select_propio_o_admin) y se cachea en memoria.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  /** true mientras el usuario cierra sesión a propósito (no es un vencimiento). */
  private salidaVoluntaria = false;

  private readonly _usuario = signal<UsuarioActual | null>(null);
  private readonly _rol = signal<RolGlobal | null>(null);
  private readonly _inicializado = signal(false);
  /** Versión de la política aceptada (undefined = aún no leída). */
  private readonly _versionPolitica = signal<string | null | undefined>(undefined);
  private readonly _errorOAuth = signal<ErrorOAuth | null>(null);
  readonly errorOAuth = this._errorOAuth.asReadonly();
  /** true mientras hay una sesión abierta desde el enlace de recuperación. */
  private readonly _enRecuperacion = signal(RECUPERACION_EN_URL || leerMarcaRecuperacion());
  readonly enRecuperacion = this._enRecuperacion.asReadonly();

  readonly usuario = this._usuario.asReadonly();
  readonly rol = this._rol.asReadonly();
  readonly inicializado = this._inicializado.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);
  readonly esAdmin = computed(() => this._rol() === 'administrador');
  readonly rutaInicio = computed(() => this.rutaInicioPorRol(this._rol()));

  private inicializacion: Promise<void> | null = null;
  private cargaRol: Promise<RolGlobal> | null = null;

  constructor() {
    if (RECUPERACION_EN_URL) this.marcarRecuperacion(true);
    this.supabase.client.auth.onAuthStateChange((evento, sesion) => {
      // No se llama a supabase.auth dentro del callback: supabase-js mantiene
      // un lock durante el evento y una llamada anidada puede bloquearse.
      this.aplicarCambioSesion(evento, sesion);
    });
    this.escucharRetornoOAuth();
  }

  /* ── Inicio de sesión con Google ─────────────────────────────────────────
   * Web: redirección completa; al volver a /login, supabase-js lee la sesión
   *      de la URL (detectSessionInUrl) y el login redirige.
   * APK: se abre Google en el navegador del sistema (Custom Tab) y Supabase
   *      devuelve a com.pacamaraqs.app://auth/callback; Android abre la app y
   *      `appUrlOpen` completa la sesión. El secreto de Google NO está en la
   *      app: vive solo en Supabase.
   */
  async iniciarConGoogle(): Promise<void> {
    this._errorOAuth.set(null);
    const nativo = Capacitor.isNativePlatform();
    const { data, error } = await this.supabase.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: nativo ? REDIRECCION_NATIVA : `${window.location.origin}/login`,
        skipBrowserRedirect: nativo,
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) throw error;
    if (nativo) {
      if (!data.url) throw new Error('Supabase no devolvió la URL de Google.');
      await Browser.open({ url: data.url });
    }
  }

  limpiarErrorOAuth(): void {
    this._errorOAuth.set(null);
  }

  private escucharRetornoOAuth(): void {
    if (!Capacitor.isNativePlatform()) return;
    void App.addListener('appUrlOpen', ({ url }) => {
      if (url.startsWith(REDIRECCION_NATIVA)) void this.completarOAuth(url);
    });
  }

  private async completarOAuth(url: string): Promise<void> {
    await Browser.close().catch(() => undefined);
    const destino = new URL(url);
    const hash = new URLSearchParams(destino.hash.replace(/^#/, ''));
    const error = destino.searchParams.get('error') ?? hash.get('error');
    if (error) {
      this._errorOAuth.set(error === 'access_denied' ? 'cancelado' : 'error');
      return;
    }
    try {
      const codigo = destino.searchParams.get('code');
      if (codigo) {
        const { error: e } = await this.supabase.client.auth.exchangeCodeForSession(codigo);
        if (e) throw e;
      } else {
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');
        if (!access_token || !refresh_token) throw new Error('Respuesta de Google sin tokens.');
        const { error: e } = await this.supabase.client.auth.setSession({ access_token, refresh_token });
        if (e) throw e;
      }
      const { session } = await this.getSession();
      if (!session?.user || session.user.is_anonymous) throw new Error('Sesión inválida.');
      this._usuario.set(this.mapearUsuario(session.user));
      const rol = await this.obtenerRol(true);
      // authGuard desvía a /aceptar-politica si es su primer ingreso.
      await this.router.navigateByUrl(this.rutaInicioPorRol(rol), { replaceUrl: true });
    } catch (e) {
      console.error('[AuthService] OAuth:', e);
      this._errorOAuth.set('error');
    }
  }

  /* ── Política de tratamiento de datos (Ley 1581) ──────────────────────── */

  /** true si el usuario no ha aceptado la versión vigente de la política. */
  async requierePolitica(): Promise<boolean> {
    if (this._versionPolitica() === undefined) await this.obtenerRol(true);
    return this._versionPolitica() !== VERSION_POLITICA;
  }

  async aceptarPolitica(): Promise<void> {
    const { error } = await this.supabase.client.rpc('aceptar_politica', { p_version: VERSION_POLITICA });
    if (error) throw error;
    this._versionPolitica.set(VERSION_POLITICA);
  }

  /** Garantiza que el estado inicial (sesión persistida + rol) esté cargado. */
  asegurarInicializado(): Promise<void> {
    this.inicializacion ??= this.inicializar();
    return this.inicializacion;
  }

  async login(email: string, password: string): Promise<RolGlobal> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw error;
    if (!data.user || data.user.is_anonymous) {
      throw new Error('No se pudo validar tu usuario autenticado.');
    }

    this._usuario.set(this.mapearUsuario(data.user));
    this._rol.set(null);
    this.cargaRol = null;
    return this.obtenerRol(true);
  }

  async registro(email: string, password: string, nombre: string) {
    const correo = email.trim();
    const nombreCompleto = nombre.trim();
    if (!correo || !password || !nombreCompleto) {
      throw new Error('El nombre, el correo y la contraseña son obligatorios.');
    }

    // El perfil en public.usuarios lo crea el trigger on_auth_user_created.
    const { data, error } = await this.supabase.client.auth.signUp({
      email: correo,
      password,
      options: { data: { nombre: nombreCompleto, version_politica: VERSION_POLITICA } }
    });
    if (error) throw error;

    if (data.session?.user) {
      this._usuario.set(this.mapearUsuario(data.session.user));
      await this.obtenerRol(true);
    }
    return data;
  }

  /* ── Recuperación de contraseña ───────────────────────────────────────
   * El enlace del correo siempre abre la versión web (Vercel): funciona
   * aunque el correo se lea en otro dispositivo y no depende de que el
   * celular abra la app. Allí se define la contraseña nueva y luego se
   * entra normalmente desde la app.
   * Supabase → Auth → URL Configuration → Redirect URLs debe incluir
   * `${environment.urlWeb}/nueva-contrasena` (y localhost en desarrollo).
   */
  async solicitarRecuperacion(email: string): Promise<void> {
    const base = Capacitor.isNativePlatform() ? environment.urlWeb : window.location.origin;
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${base}${RUTA_NUEVA_CONTRASENA}`
    });
    if (error) throw error;
  }

  async actualizarContrasena(contrasena: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password: contrasena });
    if (error) throw error;
    this.marcarRecuperacion(false);
  }

  /* ── Verificación en dos pasos (TOTP) ─────────────────────────────────
   * tieneFactor: la cuenta tiene una app de autenticación activa.
   * requiereCodigo: la sesión actual aún no pasó el segundo paso (aal1).
   * getAuthenticatorAssuranceLevel lee el token local: no hace peticiones.
   */
  async estadoDosPasos(): Promise<{ tieneFactor: boolean; requiereCodigo: boolean }> {
    const { data, error } = await this.supabase.client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    const tieneFactor = data.nextLevel === 'aal2';
    return { tieneFactor, requiereCodigo: tieneFactor && data.currentLevel !== 'aal2' };
  }

  async verificarCodigoDosPasos(codigo: string): Promise<void> {
    const mfa = this.supabase.client.auth.mfa;
    const { data, error } = await mfa.listFactors();
    if (error) throw error;
    const factor = data.totp.find(f => f.status === 'verified');
    if (!factor) throw new Error('La cuenta no tiene verificación en dos pasos.');
    const { error: e } = await mfa.challengeAndVerify({ factorId: factor.id, code: codigo });
    if (e) throw e;
  }

  /** scope 'global' cierra la sesión en todos los dispositivos de la cuenta. */
  async signOut(scope: 'local' | 'global' = 'local'): Promise<void> {
    this.salidaVoluntaria = true;
    try {
      const { error } = await this.supabase.client.auth.signOut({ scope });
      this.limpiarEstado();
      if (error) throw error;
    } finally {
      setTimeout(() => (this.salidaVoluntaria = false), 0);
    }
  }

  /**
   * Devuelve el rol del usuario actual (cacheado). `forzar` vuelve a leerlo
   * de la base de datos, p. ej. tras un login o un ascenso a administrador.
   */
  async obtenerRol(forzar = false): Promise<RolGlobal> {
    const usuario = this._usuario();
    if (!usuario) throw new Error('No hay un usuario autenticado.');

    const enCache = this._rol();
    if (enCache && !forzar) return enCache;

    if (!this.cargaRol || forzar) {
      this.cargaRol = this.leerRol(usuario.id).finally(() => {
        this.cargaRol = null;
      });
    }
    return this.cargaRol;
  }

  rutaInicioPorRol(rol: RolGlobal | null): string {
    if (rol === 'administrador') return '/admin-dashboard';
    if (rol === 'catador') return '/dashboard';
    return '/login';
  }

  /** Ruta de inicio del usuario actual o null si no hay sesión válida. */
  async obtenerRutaInicio(): Promise<string | null> {
    await this.asegurarInicializado();
    if (!this._usuario()) return null;
    const rol = await this.obtenerRol();
    return this.rutaInicioPorRol(rol);
  }

  /** Token vigente (lectura local, sin red). */
  async getSession() {
    const { data, error } = await this.supabase.client.auth.getSession();
    if (error) throw error;
    return data;
  }

  /** Valida el token contra el servidor de Auth (petición de red). */
  async getUser() {
    const { data, error } = await this.supabase.client.auth.getUser();
    if (error) throw error;
    return data;
  }

  private async inicializar(): Promise<void> {
    try {
      const { session } = await this.getSession();
      const user = session?.user;
      if (user && !user.is_anonymous) {
        this._usuario.set(this.mapearUsuario(user));
        try {
          await this.obtenerRol();
        } catch (error) {
          console.error('[AuthService] No se pudo leer el rol:', error);
        }
      } else {
        this.limpiarEstado();
      }
    } finally {
      this._inicializado.set(true);
    }
  }

  private aplicarCambioSesion(evento: AuthChangeEvent, sesion: Session | null): void {
    if (evento === 'SIGNED_OUT' || !sesion?.user || sesion.user.is_anonymous) {
      const habiaUsuario = this._usuario() !== null;
      this.limpiarEstado();
      // La sesión venció o se cerró desde otro dispositivo: avisar y volver al login.
      if (evento === 'SIGNED_OUT' && habiaUsuario && !this.salidaVoluntaria) {
        setTimeout(() => void this.avisarSesionVencida(), 0);
      }
      return;
    }

    if (evento === 'PASSWORD_RECOVERY') {
      this.marcarRecuperacion(true);
      // Si Supabase devolvió a otra ruta (p. ej. la URL del sitio), se lleva al formulario.
      setTimeout(() => {
        if (!this.router.url.startsWith(RUTA_NUEVA_CONTRASENA)) {
          void this.router.navigateByUrl(RUTA_NUEVA_CONTRASENA, { replaceUrl: true });
        }
      }, 0);
    }

    const anterior = this._usuario();
    this._usuario.set(this.mapearUsuario(sesion.user));

    if (evento === 'USER_UPDATED' || anterior?.id !== sesion.user.id) {
      this._rol.set(null);
      // Fuera del callback para no competir por el lock de supabase-js.
      setTimeout(() => {
        void this.obtenerRol(true).catch(error =>
          console.error('[AuthService] No se pudo refrescar el rol:', error)
        );
      }, 0);
    }
  }

  private async leerRol(usuarioId: string): Promise<RolGlobal> {
    const { data, error } = await this.supabase.client
      .from('usuarios')
      .select('rol_global, version_politica_aceptada')
      .eq('id', usuarioId)
      .maybeSingle();

    if (error) throw error;
    const rol = typeof data?.rol_global === 'string' ? data.rol_global.trim().toLowerCase() : '';
    if (rol !== 'catador' && rol !== 'administrador') {
      throw new Error('La cuenta no tiene un rol asignado. Contacta al administrador.');
    }

    if (this._usuario()?.id === usuarioId) {
      this._rol.set(rol);
      this._versionPolitica.set(typeof data?.version_politica_aceptada === 'string' ? data.version_politica_aceptada : null);
    }
    return rol;
  }

  private async avisarSesionVencida(): Promise<void> {
    const ruta = this.router.url;
    const { AvisosService } = await import('../avisos/avisos.service');
    void this.injector.get(AvisosService).info('errores.sesion_expirada');
    const publicas = ['/login', '/registro', '/recuperar', RUTA_NUEVA_CONTRASENA];
    if (publicas.some(p => ruta.startsWith(p))) return;
    await this.router.navigate(['/login'], { queryParams: { returnUrl: ruta }, replaceUrl: true });
  }

  /** Recuerda (también al recargar la pestaña) que falta definir la contraseña nueva. */
  private marcarRecuperacion(activa: boolean): void {
    this._enRecuperacion.set(activa);
    try {
      if (activa) sessionStorage.setItem(MARCA_RECUPERACION, '1');
      else sessionStorage.removeItem(MARCA_RECUPERACION);
    } catch { /* almacenamiento no disponible: basta con la señal */ }
  }

  private limpiarEstado(): void {
    this.marcarRecuperacion(false);
    this._usuario.set(null);
    this._rol.set(null);
    this._versionPolitica.set(undefined);
    this.cargaRol = null;
  }

  private mapearUsuario(user: User): UsuarioActual {
    const nombreMetadata = user.user_metadata?.['nombre'] ?? user.user_metadata?.['full_name'] ?? user.user_metadata?.['name'];
    const email = user.email ?? '';
    return {
      id: user.id,
      email,
      nombre: typeof nombreMetadata === 'string' && nombreMetadata.trim()
        ? nombreMetadata.trim()
        : email.split('@')[0] || 'Catador'
    };
  }
}
