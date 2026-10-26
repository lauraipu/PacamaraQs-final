import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { of, Subject } from 'rxjs';
import { EstadoSesion, Sesion } from '../../../core/models/sesion.model';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';
import { WaitingRoomPage } from './waiting-room.page';

describe('WaitingRoomPage', () => {
  let component: WaitingRoomPage;
  let fixture: ComponentFixture<WaitingRoomPage>;
  const observarParticipantes = vi.fn();
  const obtenerSesionPorId = vi.fn();
  const iniciarSesion = vi.fn();
  const getUser = vi.fn();
  let sesionUpdates: Subject<Sesion>;

  beforeEach(() => {
    vi.clearAllMocks();
    sesionUpdates = new Subject<Sesion>();
    observarParticipantes.mockReturnValue(of([]));
    const observarSesion = vi.fn().mockReturnValue(sesionUpdates.asObservable());
    getUser.mockResolvedValue({ user: { id: 'user-id' } });
    obtenerSesionPorId.mockResolvedValue({
      id: 'session-id',
      codigoAcceso: 'AB12-3C4',
      nombre: 'Cosecha',
      formato: 'combinado',
      numeroMuestras: 6,
      catadoresObjetivo: 5,
      organizadorId: 'user-id',
      organizadorParticipa: true,
      estado: EstadoSesion.EN_ESPERA
    });
    TestBed.configureTestingModule({
      imports: [WaitingRoomPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'session-id' } } }
        },
        {
          provide: SesionService,
          useValue: { observarParticipantes, observarSesion, obtenerSesionPorId, iniciarSesion }
        },
        { provide: AuthService, useValue: { getUser } },
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } }
      ]
    });
    fixture = TestBed.createComponent(WaitingRoomPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the session and subscribes to its participants', async () => {
    await fixture.whenStable();

    expect(obtenerSesionPorId).toHaveBeenCalledWith('session-id');
    expect(observarParticipantes).toHaveBeenCalledWith('session-id');
    expect(component.participantes).toEqual([]);
  });

  it('starts the session and opens its matching evaluation form', async () => {
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.sesion = await obtenerSesionPorId.mock.results[0].value;
    component.esOrganizador = true;
    component.participantes = [
      { id: '1', sesionId: 'session-id', usuarioId: 'user-id', nombre: 'Ana', esOrganizador: true, listo: true },
      { id: '2', sesionId: 'session-id', usuarioId: 'user-2', nombre: 'Beto', esOrganizador: false, listo: true },
      { id: '3', sesionId: 'session-id', usuarioId: 'user-3', nombre: 'Cami', esOrganizador: false, listo: true }
    ];

    await component.iniciarCata();

    expect(iniciarSesion).toHaveBeenCalledWith('session-id');
    expect(navigateByUrl).toHaveBeenCalledWith('/combined-form');
  });

  it('does not start the session for a non-organizer', async () => {
    component.sesion = await obtenerSesionPorId.mock.results[0].value;
    component.participantes = [
      { id: '1', sesionId: 'session-id', usuarioId: 'user-id', nombre: 'Ana', esOrganizador: true, listo: true },
      { id: '2', sesionId: 'session-id', usuarioId: 'user-2', nombre: 'Beto', esOrganizador: false, listo: true },
      { id: '3', sesionId: 'session-id', usuarioId: 'user-3', nombre: 'Cami', esOrganizador: false, listo: true }
    ];
    component.esOrganizador = false;

    await component.iniciarCata();

    expect(iniciarSesion).not.toHaveBeenCalled();
  });

  it('redirects all participants when the session starts', async () => {
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await fixture.whenStable();

    sesionUpdates.next({
      id: 'session-id',
      codigoAcceso: 'AB12-3C4',
      nombre: 'Cosecha',
      formato: 'afectivo',
      numeroMuestras: 6,
      catadoresObjetivo: 5,
      organizadorId: 'user-id',
      organizadorParticipa: true,
      estado: EstadoSesion.INICIADA
    });
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/affective-form');
  });
});
