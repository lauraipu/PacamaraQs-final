import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { EstadoSesion } from '../../../core/models/sesion.model';
import { AuthService, UsuarioActual } from '../../../core/services/auth';
import { EventoSala, PresenciaUsuario, RealtimeService } from '../../../core/services/realtime';
import { ProgresoPanel, SesionService } from '../../../core/services/sesion';
import { OrganizerDashboardPage } from './organizer-dashboard.page';

const progresoBase = (cambios: Partial<ProgresoPanel> = {}): ProgresoPanel => ({
  estado: 'en_progreso',
  numeroMuestras: 3,
  muestrasCerradas: [],
  catadores: [
    { usuarioId: 'ana', nombre: 'Ana', esOrganizador: false, listo: true, muestrasEnviadas: [1, 2, 3] },
    { usuarioId: 'beto', nombre: 'Beto', esOrganizador: false, listo: true, muestrasEnviadas: [1] },
    { usuarioId: 'caro', nombre: 'Caro', esOrganizador: false, listo: true, muestrasEnviadas: [] }
  ],
  ...cambios
});

describe('OrganizerDashboardPage', () => {
  let component: OrganizerDashboardPage;
  let router: Router;
  let eventos: Subject<EventoSala>;
  let confirmar: string;
  const usuario = signal<UsuarioActual | null>({ id: 'org', email: 'org@lab.com', nombre: 'Org' });
  const presencia = signal<ReadonlyMap<string, PresenciaUsuario>>(new Map());
  const estadoConexion = signal<'conectando' | 'conectado' | 'reconectando' | 'desconectado'>('conectado');

  const obtenerSesionPorId = vi.fn();
  const obtenerProgresoPanel = vi.fn();
  const forzarCierreMuestra = vi.fn();
  const finalizarSesionForzado = vi.fn();
  const enviar = vi.fn();
  const abrirSala = vi.fn();
  const liberarSala = vi.fn();

  const crear = async (): Promise<void> => {
    component = TestBed.createComponent(OrganizerDashboardPage).componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.ionViewWillEnter();
    await vi.waitFor(() => expect(component.cargando()).toBe(false));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    eventos = new Subject<EventoSala>();
    confirmar = 'confirm';
    presencia.set(new Map());
    estadoConexion.set('conectado');
    obtenerSesionPorId.mockResolvedValue({
      id: 'session-id', codigoAcceso: 'AB12-3C4', nombre: 'Cosecha', formato: 'combinado',
      numeroMuestras: 3, catadoresObjetivo: 3, organizadorId: 'org', organizadorParticipa: false,
      estado: EstadoSesion.INICIADA
    });
    obtenerProgresoPanel.mockResolvedValue(progresoBase());
    forzarCierreMuestra.mockResolvedValue({ numeroMuestra: 3, fichasPendientesDescartadas: 2, sesionCompletada: false });
    finalizarSesionForzado.mockResolvedValue(undefined);
    enviar.mockResolvedValue(true);
    abrirSala.mockImplementation(() => ({ presencia, estadoConexion, eventos$: eventos.asObservable(), enviar }));

    TestBed.configureTestingModule({
      imports: [OrganizerDashboardPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'session-id' }) } } },
        {
          provide: SesionService,
          useValue: { obtenerSesionPorId, obtenerProgresoPanel, forzarCierreMuestra, finalizarSesionForzado }
        },
        { provide: AuthService, useValue: { usuario, asegurarInicializado: vi.fn().mockResolvedValue(undefined) } },
        { provide: RealtimeService, useValue: { abrirSala, liberarSala } },
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
        {
          provide: AlertController,
          useValue: {
            create: vi.fn().mockImplementation(() => Promise.resolve({
              present: vi.fn(),
              onDidDismiss: vi.fn().mockResolvedValue({ role: confirmar })
            }))
          }
        }
      ]
    });
  });

  afterEach(() => {
    component?.ionViewWillLeave();
  });

  it('opens the room as organizer and builds the taster × sample matrix without scores', async () => {
    await crear();

    expect(abrirSala).toHaveBeenCalledWith(expect.objectContaining({ sesionId: 'session-id', usuarioId: 'org', rol: 'organizador' }));
    expect(component.nombreSesion()).toBe('Cosecha');
    expect(component.filas().map(f => f.celdas)).toEqual([
      ['enviada', 'enviada', 'enviada'],
      ['enviada', 'pendiente', 'pendiente'],
      ['pendiente', 'pendiente', 'pendiente']
    ]);
    expect(component.terminados()).toBe(1);
    expect(component.pendientesPorMuestra()).toEqual([
      { numero: 1, pendientes: 1, cerrada: false },
      { numero: 2, pendientes: 2, cerrada: false },
      { numero: 3, pendientes: 2, cerrada: false }
    ]);
  });

  it('treats closed samples as done and shows the grace countdown for unstable tasters', async () => {
    obtenerProgresoPanel.mockResolvedValue(progresoBase({ muestrasCerradas: [2, 3] }));
    presencia.set(new Map([
      ['beto', { usuarioId: 'beto', nombre: 'Beto', rol: 'catador', estado: 'inestable', desde: Date.now() - 15_000 }]
    ]));
    await crear();

    const beto = component.filas()[1];
    expect(beto.celdas).toEqual(['enviada', 'cerrada', 'cerrada']);
    expect(beto.terminado).toBe(true);
    expect(beto.conexion).toBe('inestable');
    expect(beto.segundosGracia).toBeGreaterThanOrEqual(29);
    expect(beto.segundosGracia).toBeLessThanOrEqual(30);
  });

  it('refreshes progress when a taster submits a sheet', async () => {
    await crear();
    obtenerProgresoPanel.mockResolvedValue(progresoBase({
      catadores: progresoBase().catadores.map(c => ({ ...c, muestrasEnviadas: [1, 2, 3] }))
    }));

    eventos.next({ tipo: 'EVALUACION_ENVIADA', usuarioId: 'caro', numeroMuestra: 3 });

    await vi.waitFor(() => expect(component.terminados()).toBe(3));
    expect(obtenerProgresoPanel).toHaveBeenCalledTimes(2);
  });

  it('force-closes a sample, broadcasts it and refreshes progress', async () => {
    await crear();

    await component.forzarCierreMuestra(3, 2);

    expect(forzarCierreMuestra).toHaveBeenCalledWith('session-id', 3);
    expect(enviar).toHaveBeenCalledWith({ tipo: 'MUESTRA_CERRADA', numeroMuestra: 3 });
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(component.accionEnCurso()).toBeNull();
  });

  it('goes to results when closing the last pending sample completes the session', async () => {
    forzarCierreMuestra.mockResolvedValue({ numeroMuestra: 3, fichasPendientesDescartadas: 1, sesionCompletada: true });
    await crear();

    await component.forzarCierreMuestra(3, 1);

    expect(enviar).toHaveBeenCalledWith({ tipo: 'SESION_FINALIZADA' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/session/session-id/results', { replaceUrl: true });
  });

  it('does nothing when the organizer cancels the confirmation', async () => {
    confirmar = 'cancel';
    await crear();

    await component.forzarCierreMuestra(2, 2);
    await component.finalizarSesion();

    expect(forzarCierreMuestra).not.toHaveBeenCalled();
    expect(finalizarSesionForzado).not.toHaveBeenCalled();
  });

  it('force-finishes the panel with an audit reason when tasters are pending', async () => {
    await crear();

    await component.finalizarSesion();

    expect(finalizarSesionForzado).toHaveBeenCalledWith(
      'session-id',
      'Finalizado por el organizador con 2 catador(es) pendiente(s)'
    );
    expect(enviar).toHaveBeenCalledWith({ tipo: 'SESION_FINALIZADA' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/session/session-id/results', { replaceUrl: true });
  });

  it('opens results directly once the panel is already closed', async () => {
    obtenerProgresoPanel.mockResolvedValue(progresoBase({ estado: 'completada' }));
    await crear();

    await component.finalizarSesion();

    expect(finalizarSesionForzado).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/session/session-id/results', { replaceUrl: true });
  });

  it('guides the panel to the next sample within bounds', async () => {
    await crear();

    await component.guiarPanel(1);
    await component.guiarPanel(5);

    expect(enviar).toHaveBeenNthCalledWith(1, { tipo: 'CAMBIAR_MUESTRA', numeroMuestra: 2 });
    expect(enviar).toHaveBeenNthCalledWith(2, { tipo: 'CAMBIAR_MUESTRA', numeroMuestra: 3 });
    expect(component.muestraGuiada()).toBe(3);
  });

  it('releases the shared room when leaving the page', async () => {
    await crear();

    component.ionViewWillLeave();

    expect(liberarSala).toHaveBeenCalledTimes(1);
  });
});
