import { ChangeDetectorRef, computed, Directive, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { EstadoSesion, getFormatoById } from '../models/sesion.model';
import { AuthService } from '../services/auth';
import { EvaluacionAtributo, FichaEvaluacion, OfflineSyncService } from '../services/offline-sync';
import { EventoSala, RealtimeService, SalaRealtime } from '../services/realtime';
import { SesionService } from '../services/sesion';
import { mensajeDeError } from '../utils/errores';

const ATRIBUTOS_HEDONICOS = new Set([
  'fragancia', 'aroma', 'sabor', 'saborResidual', 'acidez', 'dulzor', 'sensacionEnBoca'
]);

/**
 * Base de los 4 formularios CVA (combinado, afectivo, descriptivo, extrínseco).
 *
 * Offline-first:
 *  · Cada cambio (input, slider, botón) se guarda al instante en localStorage
 *    bajo `borrador_sesion_{id}_{muestra}`.
 *  · "Siguiente" envía la ficha de la muestra por OfflineSyncService (UPSERT
 *    idempotente). Sin red: "Guardado localmente. Reintentando…" + backoff.
 *  · Al reabrir (o en otro dispositivo) se restaura: borrador local > ficha
 *    ya enviada (columna `notas`) > formulario vacío.
 *
 * Tiempo real (canal de la sesión, rol catador):
 *  · CAMBIAR_MUESTRA → salta a la muestra indicada por el organizador.
 *  · MUESTRA_CERRADA → bloquea la muestra y avanza si era la actual.
 *  · SESION_FINALIZADA / PARTICIPANTE_RETIRADO → sale del formulario.
 *  · Cada ficha confirmada se anuncia con EVALUACION_ENVIADA.
 *
 * Estado escalar en Signals (zoneless). `formulario` sigue siendo un objeto
 * plano porque `ngModel` muta sus propiedades anidadas; cuando se reasigna
 * fuera de un evento de plantilla se llama a markForCheck().
 */
@Directive()
export abstract class BaseCataForm<T extends object> implements OnInit, OnDestroy {
  protected readonly route = inject(ActivatedRoute);
  protected readonly navCtrl = inject(NavController);
  protected readonly toastCtrl = inject(ToastController);
  protected readonly saveAlertCtrl = inject(AlertController);
  protected readonly authService = inject(AuthService);
  protected readonly sesionService = inject(SesionService);
  protected readonly offlineSync = inject(OfflineSyncService);
  protected readonly realtimeService = inject(RealtimeService);
  protected readonly cdr = inject(ChangeDetectorRef);

  readonly totalMuestras = signal(1);
  readonly muestraActual = signal(1);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly cargando = signal(true);
  readonly muestrasCerradas = signal<ReadonlySet<number>>(new Set());
  readonly muestrasEnviadas = signal<ReadonlySet<number>>(new Set());
  readonly esperandoSincronizacion = signal(false);

  private readonly sesionIdActual = signal('');

  readonly enLinea = this.offlineSync.enLinea;
  readonly pendientesLocales = computed(() => {
    const sesionId = this.sesionIdActual();
    return this.offlineSync.cola().filter(item => item.ficha.sesionId === sesionId).length;
  });
  readonly muestraActualCerrada = computed(() => this.muestrasCerradas().has(this.muestraActual()));
  readonly rechazoActual = computed(() => {
    const usuarioId = this.authService.usuario()?.id;
    if (!usuarioId) return null;
    return this.offlineSync.rechazos().get(`${this.sesionIdActual()}:${usuarioId}:${this.muestraActual()}`) ?? null;
  });

  respuestas: T[] = [];
  abstract formulario: T;

  /**
   * Las intensidades arrancan en null ("sin marcar") para distinguir un 0 real
   * de un control que nadie tocó. Un toque sin arrastrar no dispara `input`,
   * así que aquí se registra el valor visible del slider.
   */
  marcarIntensidad(bloque: { intensidad: number | null }, evento: Event): void {
    if (bloque.intensidad !== null) return;
    const valor = Number((evento.target as HTMLInputElement | null)?.value);
    if (Number.isFinite(valor)) bloque.intensidad = valor;
  }
  protected sesionId = '';

  private sala: SalaRealtime | null = null;
  private eventosSub?: Subscription;
  private sincronizadasSub?: Subscription;
  private destruido = false;
  private navegandoFuera = false;

  abstract crearFormularioVacio(): T;

  protected esRespuestaCompleta(_respuesta: T): boolean {
    return true;
  }

  protected calcularPuntajeFinal(_respuesta: T): number | null {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Autoguardado: cualquier interacción dentro del formulario guarda borrador.
  // Los listeners de ngModel y (click) del elemento corren antes que el burbujeo
  // hasta el host, así que el modelo ya está actualizado aquí.
  // ---------------------------------------------------------------------------
  @HostListener('input')
  @HostListener('change')
  @HostListener('click')
  @HostListener('ionInput')
  @HostListener('ionChange')
  alInteractuar(): void {
    queueMicrotask(() => this.guardarBorradorActual());
  }

  async ngOnInit(): Promise<void> {
    this.respuestas = [this.formulario];
    this.sesionId = this.route.snapshot.paramMap.get('sesionId')?.trim() ?? '';
    this.sesionIdActual.set(this.sesionId);

    if (!this.sesionId) {
      this.error.set('No se encontró el ID de la sesión.');
      this.cargando.set(false);
      return;
    }

    try {
      await this.authService.asegurarInicializado();
      const usuario = this.authService.usuario();
      if (!usuario) throw new Error('Debes iniciar sesión para evaluar.');

      const sesion = await this.sesionService.obtenerSesionPorId(this.sesionId);
      if (!sesion) throw new Error('No se encontró la sesión de cata.');

      const esExtrinseco = getFormatoById(sesion.formato).id === 'extrinseca';
      if (!esExtrinseco && sesion.estado === EstadoSesion.EN_ESPERA) {
        await this.salirA(`/session/waiting/${this.sesionId}`);
        return;
      }
      if (sesion.estado === EstadoSesion.FINALIZADA || sesion.estado === EstadoSesion.CANCELADA) {
        await this.salirA(`/session/${this.sesionId}/evaluation-complete`);
        return;
      }

      const total = Math.max(1, sesion.numeroMuestras);
      const [cerradas, enviadas] = await Promise.all([
        this.sesionService.obtenerMuestrasCerradas(this.sesionId),
        this.offlineSync.obtenerFichasEnviadas(this.sesionId).catch(error => {
          console.warn('[CVA] No se pudieron leer las fichas enviadas:', error);
          return [];
        })
      ]);
      if (this.destruido) return;

      const notasPorMuestra = new Map(enviadas.map(f => [f.numeroMuestra, f.notas]));
      this.totalMuestras.set(total);
      this.muestrasCerradas.set(new Set(cerradas));
      this.muestrasEnviadas.set(new Set(enviadas.map(f => f.numeroMuestra)));
      this.respuestas = Array.from({ length: total }, (_, indice) =>
        this.restaurarRespuesta(indice + 1, notasPorMuestra.get(indice + 1) ?? null)
      );

      const primeraAbierta = Array.from({ length: total }, (_, i) => i + 1)
        .find(n => !this.muestrasEnviadas().has(n) && !this.muestrasCerradas().has(n)) ?? 1;
      this.mostrarMuestra(primeraAbierta);

      this.conectarTiempoReal(usuario.id, usuario.nombre);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo cargar la sesión.'));
      console.error('Error al cargar la sesión para la evaluación:', error);
      await this.mostrarToast(this.error() ?? 'No se pudo cargar la sesión.', 'danger');
    } finally {
      this.cargando.set(false);
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.guardarBorradorActual();
    this.eventosSub?.unsubscribe();
    this.sincronizadasSub?.unsubscribe();
    if (this.sala) this.realtimeService.liberarSala(this.sala);
    this.sala = null;
  }

  // ---------------------------------------------------------------------------
  // Navegación entre muestras
  // ---------------------------------------------------------------------------

  async irAMuestraSiguiente(): Promise<void> {
    if (this.guardando()) return;
    const actual = this.muestraActual();

    if (!this.muestrasCerradas().has(actual)) {
      if (!this.esRespuestaCompleta(this.formulario)) {
        await this.mostrarAvisoCalificacionIncompleta();
        return;
      }
      this.guardando.set(true);
      try {
        const resultado = await this.enviarMuestra(actual);
        if (resultado === 'rechazada') return;
      } finally {
        this.guardando.set(false);
      }
    }

    const siguiente = this.siguienteMuestraAbierta(actual);
    if (siguiente === null) {
      await this.finalizarCata();
      return;
    }
    this.mostrarMuestra(siguiente);
  }

  irAMuestraAnterior(): void {
    const actual = this.muestraActual();
    if (actual <= 1) return;
    this.guardarBorradorActual();
    this.mostrarMuestra(actual - 1);
  }

  async finalizarCata(): Promise<void> {
    if (this.guardando()) return;
    this.guardarBorradorActual();

    const abiertas = Array.from({ length: this.totalMuestras() }, (_, i) => i + 1)
      .filter(n => !this.muestrasCerradas().has(n));
    const incompleta = abiertas.find(n => !this.esRespuestaCompleta(this.respuestas[n - 1]));
    if (incompleta !== undefined) {
      this.mostrarMuestra(incompleta);
      await this.mostrarAvisoCalificacionIncompleta();
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    try {
      const resultados = await Promise.all(abiertas.map(n => this.enviarMuestra(n)));
      if (resultados.includes('rechazada')) return;

      if (resultados.includes('pendiente') || this.offlineSync.pendientesDeSesion(this.sesionId).length > 0) {
        this.esperandoSincronizacion.set(true);
        await this.mostrarToast('Guardado localmente. Reintentando… Te avisaremos al sincronizar.', 'warning');
        return;
      }

      await this.irAPantallaFinalizacion();
    } finally {
      this.guardando.set(false);
    }
  }

  /** Sale del formulario aunque queden fichas en cola (se enviarán al reconectar). */
  async salirConPendientes(): Promise<void> {
    this.offlineSync.reintentarAhora();
    await this.irAPantallaFinalizacion();
  }

  reintentarSincronizacion(): void {
    this.offlineSync.reintentarAhora();
  }

  volver(): void {
    this.guardarBorradorActual();
    void this.navCtrl.back();
  }

  // ---------------------------------------------------------------------------
  // Envío de fichas
  // ---------------------------------------------------------------------------

  private async enviarMuestra(numeroMuestra: number): Promise<'sincronizada' | 'pendiente' | 'rechazada'> {
    const usuarioId = this.authService.usuario()?.id;
    if (!usuarioId) {
      this.error.set('Tu sesión expiró. Inicia sesión de nuevo; tus respuestas quedaron guardadas en este dispositivo.');
      return 'rechazada';
    }

    const respuesta = this.respuestas[numeroMuestra - 1];
    this.offlineSync.guardarBorrador(this.sesionId, numeroMuestra, respuesta);
    const resultado = await this.offlineSync.enviar(this.construirFicha(usuarioId, numeroMuestra, respuesta));

    if (resultado.estado === 'rechazada') {
      const mensaje = resultado.mensaje ?? 'El servidor rechazó la ficha.';
      if (/cerrada|terminó/i.test(mensaje)) {
        this.marcarCerrada(numeroMuestra);
      }
      const alerta = await this.saveAlertCtrl.create({
        header: `Muestra ${numeroMuestra} no guardada`,
        message: mensaje,
        buttons: ['Entendido']
      });
      await alerta.present();
    }
    return resultado.estado;
  }

  private construirFicha(usuarioId: string, numeroMuestra: number, respuesta: T): FichaEvaluacion {
    const formulario = this.comoRegistro(respuesta);
    const defectos = this.comoRegistro(formulario['defectos']);
    const tiposDefecto = Array.isArray(formulario['tiposDefecto']) ? formulario['tiposDefecto'] : [];

    return {
      sesionId: this.sesionId,
      catadorId: usuarioId,
      numeroMuestra,
      impresionGlobal: this.numeroONulo(formulario['impresionGlobal']),
      tazasNoUniformes: this.numeroO(defectos['tazasNoUniformes']),
      tazasDefectuosas: Math.max(this.numeroO(defectos['tazasDefectuosas']), tiposDefecto.length > 0 ? 1 : 0),
      puntajeFinal: this.calcularPuntajeFinal(respuesta),
      notas: JSON.stringify(respuesta),
      atributos: this.extraerAtributos(formulario)
    };
  }

  protected async irAPantallaFinalizacion(): Promise<void> {
    if (!this.sesionId) return;
    try {
      const usuarioId = this.authService.usuario()?.id;
      const esOrganizador = usuarioId
        ? await this.sesionService.esOrganizadorDeSesion(this.sesionId, usuarioId)
        : false;
      await this.salirA(`/session/${this.sesionId}/evaluation-complete?organizador=${esOrganizador ? '1' : '0'}`);
    } catch {
      // Sin red: igual se sale; las fichas siguen en la cola persistente.
      await this.salirA(`/session/${this.sesionId}/evaluation-complete`);
    }
  }

  // ---------------------------------------------------------------------------
  // Tiempo real
  // ---------------------------------------------------------------------------

  private conectarTiempoReal(usuarioId: string, nombre: string): void {
    if (this.destruido) return;
    this.sala = this.realtimeService.abrirSala({ sesionId: this.sesionId, usuarioId, nombre, rol: 'catador' });
    this.eventosSub = this.sala.eventos$.subscribe(evento => void this.manejarEvento(evento, usuarioId));

    this.sincronizadasSub = this.offlineSync.sincronizadas$
      .pipe(filter(ficha => ficha.sesionId === this.sesionId && ficha.catadorId === usuarioId))
      .subscribe(ficha => {
        const enviadas = new Set(this.muestrasEnviadas());
        enviadas.add(ficha.numeroMuestra);
        this.muestrasEnviadas.set(enviadas);
        void this.sala?.enviar({ tipo: 'EVALUACION_ENVIADA', usuarioId, numeroMuestra: ficha.numeroMuestra });

        if (this.esperandoSincronizacion() && this.offlineSync.pendientesDeSesion(this.sesionId).length === 0) {
          this.esperandoSincronizacion.set(false);
          void this.mostrarToast('Fichas sincronizadas.', 'success');
          void this.irAPantallaFinalizacion();
        }
      });
  }

  private async manejarEvento(evento: EventoSala, usuarioId: string): Promise<void> {
    switch (evento.tipo) {
      case 'CAMBIAR_MUESTRA':
        if (evento.numeroMuestra <= this.totalMuestras() && evento.numeroMuestra !== this.muestraActual()) {
          this.guardarBorradorActual();
          this.mostrarMuestra(evento.numeroMuestra);
          await this.mostrarToast(`El organizador llevó el panel a la muestra ${evento.numeroMuestra}.`, 'dark');
        }
        break;
      case 'MUESTRA_CERRADA':
        this.marcarCerrada(evento.numeroMuestra);
        if (evento.numeroMuestra === this.muestraActual()) {
          await this.mostrarToast(`La muestra ${evento.numeroMuestra} fue cerrada por el organizador.`, 'warning');
          const siguiente = this.siguienteMuestraAbierta(evento.numeroMuestra);
          if (siguiente !== null) this.mostrarMuestra(siguiente);
        }
        break;
      case 'PARTICIPANTE_RETIRADO':
        if (evento.usuarioId === usuarioId) {
          await this.mostrarToast('Fuiste retirado de la sesión por desconexión prolongada.', 'warning');
          await this.salirA('/dashboard');
        }
        break;
      case 'SESION_FINALIZADA':
      case 'RESYNC':
        await this.resincronizar();
        break;
      default:
        break;
    }
  }

  private async resincronizar(): Promise<void> {
    try {
      const [sesion, cerradas] = await Promise.all([
        this.sesionService.obtenerSesionPorId(this.sesionId),
        this.sesionService.obtenerMuestrasCerradas(this.sesionId)
      ]);
      if (this.destruido) return;
      this.muestrasCerradas.set(new Set(cerradas));

      if (!sesion || sesion.estado === EstadoSesion.FINALIZADA || sesion.estado === EstadoSesion.CANCELADA) {
        this.guardarBorradorActual();
        await this.mostrarToast('El organizador cerró el panel.', 'dark');
        await this.irAPantallaFinalizacion();
      }
    } catch (error) {
      console.warn('[CVA] Resincronización fallida:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Estado local
  // ---------------------------------------------------------------------------

  private mostrarMuestra(numeroMuestra: number): void {
    const indice = Math.min(Math.max(1, numeroMuestra), this.totalMuestras()) - 1;
    this.muestraActual.set(indice + 1);
    this.formulario = this.respuestas[indice];
    this.cdr.markForCheck();
  }

  private siguienteMuestraAbierta(desde: number): number | null {
    for (let n = desde + 1; n <= this.totalMuestras(); n++) {
      if (!this.muestrasCerradas().has(n)) return n;
    }
    return null;
  }

  private marcarCerrada(numeroMuestra: number): void {
    const cerradas = new Set(this.muestrasCerradas());
    cerradas.add(numeroMuestra);
    this.muestrasCerradas.set(cerradas);
  }

  private guardarBorradorActual(): void {
    if (!this.sesionId || this.cargando() || this.muestrasCerradas().has(this.muestraActual())) return;
    this.offlineSync.guardarBorrador(this.sesionId, this.muestraActual(), this.formulario);
  }

  private restaurarRespuesta(numeroMuestra: number, notasServidor: string | null): T {
    const vacio = this.crearFormularioVacio();
    const borrador = this.offlineSync.leerBorrador<Partial<T>>(this.sesionId, numeroMuestra);
    if (borrador && typeof borrador === 'object') return { ...vacio, ...borrador };

    if (notasServidor) {
      try {
        const desdeServidor = JSON.parse(notasServidor) as unknown;
        if (this.esRegistro(desdeServidor)) return { ...vacio, ...(desdeServidor as Partial<T>) };
      } catch {
        // `notas` no era un formulario serializado: se usa el vacío.
      }
    }
    return vacio;
  }

  private async salirA(url: string): Promise<void> {
    if (this.navegandoFuera) return;
    this.navegandoFuera = true;
    await this.navCtrl.navigateRoot(url);
  }

  protected async mostrarAvisoCalificacionIncompleta(): Promise<void> {
    await this.mostrarToast('Por favor completa los atributos obligatorios.', 'warning');
  }

  protected async mostrarToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color });
    await toast.present();
  }

  // ---------------------------------------------------------------------------
  // Extracción de atributos (estructura genérica de los 4 formularios)
  // ---------------------------------------------------------------------------

  private extraerAtributos(formulario: Record<string, unknown>): EvaluacionAtributo[] {
    const atributos: EvaluacionAtributo[] = [];

    const recorrer = (valor: unknown, ruta: string): void => {
      if (!this.esRegistro(valor)) return;

      const intensidad = this.numeroONulo(valor['intensidad']);
      const calidad = this.numeroONulo(valor['calidad']);
      if (intensidad !== null || calidad !== null) {
        const atributo = ruta.replace(/^atributos\./, '');
        if (atributo) {
          atributos.push({
            atributo,
            ...(intensidad !== null ? { intensidad } : {}),
            ...(calidad !== null ? { calidad } : {})
          });
        }
        return;
      }

      for (const [clave, hijo] of Object.entries(valor)) {
        if (clave === 'defectos' || clave === 'tiposDefecto' || clave === 'mouthfeel') continue;
        if (!ruta && ATRIBUTOS_HEDONICOS.has(clave) && typeof hijo === 'number' && Number.isFinite(hijo)) {
          atributos.push({ atributo: clave, calidad: hijo });
          continue;
        }
        if (this.esRegistro(hijo)) recorrer(hijo, ruta ? `${ruta}.${clave}` : clave);
      }
    };

    recorrer(formulario, '');
    return atributos;
  }

  private comoRegistro(valor: unknown): Record<string, unknown> {
    return this.esRegistro(valor) ? valor : {};
  }

  private esRegistro(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  }

  private numeroO(valor: unknown): number {
    return this.numeroONulo(valor) ?? 0;
  }

  private numeroONulo(valor: unknown): number | null {
    return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
  }
}
