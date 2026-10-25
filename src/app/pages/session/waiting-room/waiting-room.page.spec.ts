import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { EstadoSesion } from '../../../core/models/sesion.model';
import { SesionService } from '../../../core/services/sesion';
import { WaitingRoomPage } from './waiting-room.page';

describe('WaitingRoomPage', () => {
  let component: WaitingRoomPage;
  let fixture: ComponentFixture<WaitingRoomPage>;
  const observarParticipantes = vi.fn();
  const obtenerSesionPorId = vi.fn();
  const iniciarSesion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    observarParticipantes.mockReturnValue(of([]));
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
          useValue: { observarParticipantes, obtenerSesionPorId, iniciarSesion }
        },
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

  it('loads the session and subscribes to its participants', () => {
    expect(obtenerSesionPorId).toHaveBeenCalledWith('session-id');
    expect(observarParticipantes).toHaveBeenCalledWith('session-id');
    expect(component.participantes).toEqual([]);
  });

  it('starts the session and opens its matching evaluation form', async () => {
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.sesion = await obtenerSesionPorId.mock.results[0].value;

    await component.iniciarCata();

    expect(iniciarSesion).toHaveBeenCalledWith('session-id');
    expect(navigateByUrl).toHaveBeenCalledWith('/combined-form');
  });
});
