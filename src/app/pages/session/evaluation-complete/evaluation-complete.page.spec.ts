import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { EstadoSesion, Sesion } from '../../../core/models/sesion.model';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';
import { EvaluationCompletePage } from './evaluation-complete.page';

const sesionBase = (): Sesion => ({
  id: 'session-id',
  codigoAcceso: 'AB12-3C4',
  nombre: 'Cosecha',
  formato: 'combinado',
  numeroMuestras: 3,
  catadoresObjetivo: 5,
  organizadorId: 'organizer-id',
  organizadorParticipa: false,
  estado: EstadoSesion.FINALIZADA
});

describe('EvaluationCompletePage', () => {
  const getSession = vi.fn();
  const obtenerSesionPorId = vi.fn();
  const navigateRoot = vi.fn();
  let router: Router;

  const crear = async (usuarioId: string | null): Promise<EvaluationCompletePage> => {
    getSession.mockResolvedValue({ session: usuarioId ? { user: { id: usuarioId } } : null });
    const component = TestBed.createComponent(EvaluationCompletePage).componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await component.ngOnInit();
    return component;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    obtenerSesionPorId.mockResolvedValue(sesionBase());
    TestBed.configureTestingModule({
      imports: [EvaluationCompletePage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getSession } },
        { provide: SesionService, useValue: { obtenerSesionPorId } },
        { provide: NavController, useValue: { navigateRoot } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'session-id' }) } } }
      ]
    });
  });

  it('never shows the access code and offers results to the organizer once the panel is closed', async () => {
    const component = await crear('organizer-id');

    expect(component.nombreSesion()).toBe('Cosecha');
    expect(component.esOrganizador()).toBe(true);
    expect(component.puedeVerResultados()).toBe(true);
    expect('codigoSesion' in component).toBe(false);

    await component.irAResultados();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/session/session-id/results');
  });

  it('sends the organizer to the monitor instead of results while tasters are still evaluating', async () => {
    obtenerSesionPorId.mockResolvedValue({ ...sesionBase(), estado: EstadoSesion.INICIADA });
    const component = await crear('organizer-id');

    expect(component.puedeVerResultados()).toBe(false);
    expect(component.debeFinalizarPanel()).toBe(true);

    await component.irAResultados();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    await component.irAMonitoreo();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/session/session-id/organizer-dashboard');
  });

  it('treats extrinsic sessions as individual (technical sheet, no monitor)', async () => {
    obtenerSesionPorId.mockResolvedValue({ ...sesionBase(), formato: 'extrinseca', estado: EstadoSesion.FINALIZADA });
    const component = await crear('organizer-id');

    expect(component.esExtrinseco()).toBe(true);
    expect(component.debeFinalizarPanel()).toBe(false);
    expect(component.puedeVerResultados()).toBe(true);
  });

  it('keeps results hidden from tasters (blind evaluation)', async () => {
    const component = await crear('taster-id');

    expect(component.esOrganizador()).toBe(false);
    expect(component.puedeVerResultados()).toBe(false);

    await component.irAResultados();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('sends unauthenticated users to the login', async () => {
    const component = await crear(null);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
    expect(obtenerSesionPorId).not.toHaveBeenCalled();
    expect(component.cargando()).toBe(false);
  });

  it('shows an error when the session cannot be read', async () => {
    obtenerSesionPorId.mockResolvedValue(null);

    const component = await crear('taster-id');

    expect(component.error()).toBe('No se encontró la sesión.');
    expect(component.cargando()).toBe(false);
  });

  it('returns to the main dashboard', async () => {
    const component = await crear('taster-id');

    component.volverAlPanel();

    expect(navigateRoot).toHaveBeenCalledWith('/dashboard');
  });
});
