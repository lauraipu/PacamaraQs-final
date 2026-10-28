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
  const insertarParticipanteDirecto = vi.fn();
  const getUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [CreateSessionPage],
      providers: [
        provideRouter([]),
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
        { provide: AuthService, useValue: { getUser } },
        { provide: SesionService, useValue: { crearSesion, insertarParticipanteDirecto } }
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

  it('creates a session and registers the organizer as a participant', async () => {
    getUser.mockResolvedValue({
      user: {
        id: 'user-id',
        email: 'organizer@example.com',
        user_metadata: {}
      }
    });
    crearSesion.mockImplementation(async (session) => ({
      ...session,
      id: 'session-id',
      codigoAcceso: 'AB12-3C4'
    }));
    insertarParticipanteDirecto.mockResolvedValue(undefined);

    component.nombreSesion = '  Cosecha de mayo  ';
    await component.generarCodigo();

    expect(crearSesion).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Cosecha de mayo',
      organizadorId: 'user-id',
      organizadorParticipa: true
    }));
    expect(insertarParticipanteDirecto).toHaveBeenCalledWith(
      'session-id',
      'user-id',
      'organizer@example.com',
      true
    );
    expect(component.codigoGenerado).toBe('AB12-3C4');
    expect(component.pasoActual).toBe(2);
    expect(component.error).toBeNull();
  });

  it('creates extrinsic sessions with valid defaults and does not register the organizer', async () => {
    getUser.mockResolvedValue({
      user: {
        id: 'user-id',
        email: 'organizer@example.com',
        user_metadata: {}
      }
    });
    crearSesion.mockImplementation(async session => ({
      ...session,
      id: 'session-id',
      codigoAcceso: 'AB12-3C4'
    }));

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
    expect(insertarParticipanteDirecto).not.toHaveBeenCalled();
    expect(component.organizadorPendiente).toBe(false);
  });

  it('does not recreate a session when organizer registration fails', async () => {
    getUser.mockResolvedValue({
      user: { id: 'user-id', email: 'organizer@example.com', user_metadata: {} }
    });
    crearSesion.mockResolvedValue({
      id: 'session-id',
      codigoAcceso: 'AB12-3C4',
      nombre: 'Cosecha',
      formato: 'combinado',
      numeroMuestras: 6,
      catadoresObjetivo: 5,
      organizadorId: 'user-id',
      organizadorParticipa: true,
      estado: 'EN_ESPERA'
    });
    insertarParticipanteDirecto.mockRejectedValue(new Error('insert denied'));

    component.nombreSesion = 'Cosecha';
    await component.generarCodigo();

    expect(crearSesion).toHaveBeenCalledTimes(1);
    expect(component.pasoActual).toBe(2);
    expect(component.organizadorPendiente).toBe(true);
    expect(component.error).toContain('insert denied');
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

  it('routes to the waiting room for the created session', async () => {
    component.sesionIdGenerado = 'session-id';
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.irASalaDeEspera();

    expect(navigate).toHaveBeenCalledWith(['/session/waiting', 'session-id']);
  });

  it('routes extrinsic sessions directly to the evaluation form', async () => {
    component.sesionIdGenerado = 'session-id';
    component.formatoSeleccionado = 'extrinseca';
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.irASalaDeEspera();

    expect(navigate).toHaveBeenCalledWith(['/extrinsic-form', 'session-id']);
  });
});
