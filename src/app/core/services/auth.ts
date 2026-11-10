import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase';

/** Deep link de regreso del OAuth en la APK (Supabase → Redirect URLs + AndroidManifest). */
export const REDIRECCION_NATIVA = 'com.pacamaraqs.app://auth/callback';
export type ErrorOAuth = 'cancelado' | 'error';

export type RolGlobal = 'catador' | 'administrador';

export interface UsuarioActual {
  id: string;
  email: string;
  nombre: string;
}

/** Versión de la política de privacidad aceptada en el registro. */
export const VERSION_POLITICA = '1.0';

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

  private readonly _usuario = signal<UsuarioActual | null>(null);
  private readonly _rol = signal<RolGlobal | null>(null);
  private readonly _inicializado = signal(false);
  /** Versión de la política aceptada (undefined = aún no leída). */
  private readonly _versionPolitica = signal<string | null | undefined>(undefined);
  private readonly _errorOAuth = signal<ErrorOAuth | null>(null);
  readonly errorOAuth = this._errorOAuth.asReadonly();

  readonly usuario = this._usuario.asReadonly();
  readonly rol = this._rol.asReadonly();
  readonly inicializado = this._inicializado.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);
  readonly esAdmin = computed(() => this._rol() === 'administrador');
  readonly rutaInicio = computed(() => this.rutaInicioPorRol(this._rol()));

  private inicializacion: Promise<void> | null = null;
  private cargaRol: Promise<RolGlobal> | null = null;

  constructor() {
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

  async signOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    this.limpiarEstado();
    if (error) throw error;
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
      this.limpiarEstado();
      return;
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

  private limpiarEstado(): void {
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
