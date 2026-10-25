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
});
