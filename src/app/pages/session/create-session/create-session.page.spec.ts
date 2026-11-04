import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';
import { CreateSessionPage } from './create-session.page';

describe('CreateSessionPage', () => {
  let component: CreateSessionPage;
  let fixture: ComponentFixture<CreateSessionPage>;
  const crearSesion = vi.fn();
  const getUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [CreateSessionPage],
      providers: [
        provideRouter([]),
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
        { provide: AuthService, useValue: { getUser } },
        { provide: SesionService, useValue: { crearSesion } }
      ]
    });
    fixture = TestBed.createComponent(CreateSessionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hides panel parameters for extrinsic format', () => {
    const getParametersSection = () => {
      const sections = fixture.nativeElement.querySelectorAll('section.cupping-card') as NodeListOf<HTMLElement>;
      return Array.from(sections).find(section => section.textContent?.includes('Parámetros del panel'));
    };
    const selectFormat = (format: string) => {
      const buttons = fixture.nativeElement.querySelectorAll('button.formato-item') as NodeListOf<HTMLButtonElement>;
      const button = Array.from(buttons).find(item => item.textContent?.includes(format));
      button?.click();
      fixture.detectChanges();
    };

    expect(getParametersSection()).toBeTruthy();

    selectFormat('Extrínseca');
    expect(getParametersSection()).toBeUndefined();

    selectFormat('Combinado');
    expect(getParametersSection()).toBeTruthy();
  });

  it('creates the session through the RPC (organizer is registered server-side)', async () => {
    getUser.mockResolvedValue({ user: { id: 'user-id', email: 'organizer@example.com', user_metadata: {} } });
    crearSesion.mockImplementation(async session => ({ ...session, id: 'session-id', codigoAcceso: 'AB12-3C4' }));

    component.nombreSesion = '  Cosecha de mayo  ';
    await component.generarCodigo();

    expect(crearSesion).toHaveBeenCalledTimes(1);
    expect(crearSesion).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Cosecha de mayo',
      organizadorParticipa: true
    }));
    expect(component.codigoGenerado).toBe('AB12-3C4');
    expect(component.pasoActual).toBe(2);
    expect(component.error).toBeNull();
  });

  it('creates extrinsic sessions with valid defaults', async () => {
    getUser.mockResolvedValue({ user: { id: 'user-id', email: 'organizer@example.com', user_metadata: {} } });
    crearSesion.mockImplementation(async session => ({ ...session, id: 'session-id', codigoAcceso: 'AB12-3C4' }));

    component.nombreSesion = 'Cata extrínseca';
    component.formatoSeleccionado = 'extrinseca';
    component.numeroMuestras = 12;
    component.catadoresObjetivo = 10;
    component.participaComoCatador = true;

    await component.generarCodigo();

    expect(crearSesion).toHaveBeenCalledWith(expect.objectContaining({
      formato: 'extrinseca',
      numeroMuestras: 1,
      catadoresObjetivo: 3,
      organizadorParticipa: false
    }));
  });

  it('shows the backend error and stays on step 1 when creation fails', async () => {
    getUser.mockResolvedValue({ user: { id: 'user-id', email: 'organizer@example.com', user_metadata: {} } });
    crearSesion.mockRejectedValue(new Error('permission denied'));

    component.nombreSesion = 'Cosecha';
    await component.generarCodigo();

    expect(component.pasoActual).toBe(1);
    expect(component.error).toContain('permission denied');
    expect(component.isLoading).toBe(false);
  });

  it('does not create a session when no user is authenticated', async () => {
    getUser.mockResolvedValue({ user: null });
    component.nombreSesion = 'Cosecha';

    await component.generarCodigo();

    expect(crearSesion).not.toHaveBeenCalled();
    expect(component.pasoActual).toBe(1);
    expect(component.error).toBe('Debes iniciar sesión para crear una sesión.');
    expect(component.isLoading).toBe(false);
  });

  it('routes to the waiting room for non-extrinsic sessions', async () => {
    component.sesionIdGenerado = 'session-id';
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await component.irASalaDeEspera();

    expect(navigateByUrl).toHaveBeenCalledWith('/session/waiting/session-id', { replaceUrl: true });
  });

  it('routes extrinsic sessions directly to their form', async () => {
    component.sesionIdGenerado = 'session-id';
    component.formatoSeleccionado = 'extrinseca';
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await component.irASalaDeEspera();

    expect(navigateByUrl).toHaveBeenCalledWith('/extrinsic-form/session-id', { replaceUrl: true });
  });
});
