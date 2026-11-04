import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { EstadoSesion, Participante, Sesion } from '../../../core/models/sesion.model';
import { AuthService, UsuarioActual } from '../../../core/services/auth';
import { EventoSala, PresenciaUsuario, RealtimeService } from '../../../core/services/realtime';
import { SesionService } from '../../../core/services/sesion';
import { WaitingRoomPage } from './waiting-room.page';

const participante = (usuarioId: string, listo: boolean, esOrganizador = false): Participante => ({
  id: `p-${usuarioId}`,
  sesionId: 'session-id',
  usuarioId,
  nombre: usuarioId,
  esOrganizador,
  listo
});

const sesionBase = (cambios: Partial<Sesion> = {}): Sesion => ({
  id: 'session-id',
  codigoAcceso: 'AB12-3C4',
  nombre: 'Cosecha',
  formato: 'combinado',
  numeroMuestras: 6,
  catadoresObjetivo: 5,
  organizadorId: 'user-id',
  organizadorParticipa: true,
  estado: EstadoSesion.EN_ESPERA,
  ...cambios
});

describe('WaitingRoomPage', () => {
  let component: WaitingRoomPage;
  let fixture: ComponentFixture<WaitingRoomPage>;
  let router: Router;
  let eventos: Subject<EventoSala>;
  const usuario = signal<UsuarioActual | null>(null);
  const presencia = signal<ReadonlyMap<string, PresenciaUsuario>>(new Map());
  const estadoConexion = signal<'conectando' | 'conectado' | 'reconectando' | 'desconectado'>('conectado');

  const obtenerSesionPorId = vi.fn();
  const obtenerParticipantes = vi.fn();
  const iniciarSesion = vi.fn();
  const marcarComoListo = vi.fn();
  const abandonarSesion = vi.fn();
  const enviar = vi.fn();
  const abrirSala = vi.fn();
  const liberarSala = vi.fn();

  const crear = async (usuarioId = 'user-id', sesion = sesionBase(), participantes: Participante[] = []) => {
    usuario.set({ id: usuarioId, email: `${usuarioId}@lab.com`, nombre: usuarioId });
    obtenerSesionPorId.mockResolvedValue(sesion);
    obtenerParticipantes.mockResolvedValue(participantes);
    fixture = TestBed.createComponent(WaitingRoomPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    component.ionViewWillEnter();
    await fixture.whenStable();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    eventos = new Subject<EventoSala>();
    presencia.set(new Map());
    estadoConexion.set('conectado');
    iniciarSesion.mockResolvedValue(undefined);
    marcarComoListo.mockResolvedValue(undefined);
    abandonarSesion.mockResolvedValue(undefined);
    enviar.mockResolvedValue(true);
    abrirSala.mockImplementation(opciones => ({
      opciones,
      sesionId: opciones.sesionId,
      presencia,
      estadoConexion,
      eventos$: eventos.asObservable(),
      enviar
    }));

    TestBed.configureTestingModule({
      imports: [WaitingRoomPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'session-id' } } } },
        {
          provide: SesionService,
          useValue: { obtenerSesionPorId, obtenerParticipantes, iniciarSesion, marcarComoListo, abandonarSesion }
        },
        { provide: AuthService, useValue: { usuario, asegurarInicializado: vi.fn().mockResolvedValue(undefined) } },
        { provide: RealtimeService, useValue: { abrirSala, liberarSala } },
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
        {
          provide: AlertController,
          useValue: {
            create: vi.fn().mockResolvedValue({
              present: vi.fn(),
              onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' })
            })
          }
        }
      ]
    });
  });

  it('loads session and participants from the database and opens the realtime room', async () => {
    await crear('user-id', sesionBase(), [participante('user-id', true, true)]);

    expect(obtenerSesionPorId).toHaveBeenCalledWith('session-id');
    expect(obtenerParticipantes).toHaveBeenCalledWith('session-id');
    expect(abrirSala).toHaveBeenCalledWith(expect.objectContaining({ sesionId: 'session-id', rol: 'organizador' }));
    expect(component.cargando()).toBe(false);
  });

  it('shows an error instead of an infinite spinner when loading fails', async () => {
    usuario.set({ id: 'user-id', email: 'u@lab.com', nombre: 'u' });
    obtenerSesionPorId.mockRejectedValueOnce(new Error('boom'));
    obtenerParticipantes.mockResolvedValue([]);
    fixture = TestBed.createComponent(WaitingRoomPage);
    component = fixture.componentInstance;
    component.ionViewWillEnter();
    await fixture.whenStable();

    expect(component.cargando()).toBe(false);
    expect(component.error()).toBe('boom');
  });

  it('marks a taster as unstable when presence is lost', async () => {
    await crear('user-id', sesionBase(), [participante('user-id', true, true), participante('user-2', false)]);
    presencia.set(new Map([
      ['user-2', { usuarioId: 'user-2', nombre: 'user-2', rol: 'catador', estado: 'inestable', desde: Date.now() }]
    ]));

    const fila = component.participantesEnSala().find(p => p.usuarioId === 'user-2');
    expect(fila?.conexion).toBe('inestable');
    expect(fila?.segundosGracia).toBeGreaterThan(40);
  });

  it('requires three ready participants before enabling the start action', async () => {
    await crear('user-id', sesionBase(), [
      participante('user-id', true, true), participante('user-2', true), participante('user-3', false)
    ]);
    expect(component.puedeIniciar()).toBe(false);

    eventos.next({ tipo: 'LISTO', usuarioId: 'user-3', listo: true });
    await fixture.whenStable();
    expect(component.puedeIniciar()).toBe(true);
  });

  it('starts the session, broadcasts INICIAR_CATA and opens the matching form', async () => {
    await crear('user-id', sesionBase(), [
      participante('user-id', true, true), participante('user-2', true), participante('user-3', true)
    ]);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await component.iniciarCata();

    expect(iniciarSesion).toHaveBeenCalledWith('session-id');
    expect(enviar).toHaveBeenCalledWith({ tipo: 'INICIAR_CATA' });
    expect(navigateByUrl).toHaveBeenCalledWith('/combined-form/session-id', { replaceUrl: true });
  });

  it('verifies against the database before following an INICIAR_CATA broadcast', async () => {
    await crear('user-2', sesionBase(), [participante('user-id', true, true), participante('user-2', true)]);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    obtenerSesionPorId.mockResolvedValue(sesionBase());
    eventos.next({ tipo: 'INICIAR_CATA' });
    await fixture.whenStable();
    expect(navigateByUrl).not.toHaveBeenCalled();

    obtenerSesionPorId.mockResolvedValue(sesionBase({ formato: 'afectivo', estado: EstadoSesion.INICIADA }));
    eventos.next({ tipo: 'INICIAR_CATA' });
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledWith('/affective-form/session-id', { replaceUrl: true });
  });

  it('lets a taster toggle ready through the RPC and broadcasts it', async () => {
    await crear('user-2', sesionBase(), [participante('user-id', true, true), participante('user-2', false)]);

    await component.alternarListo();

    expect(marcarComoListo).toHaveBeenCalledWith('session-id', true);
    expect(enviar).toHaveBeenCalledWith({ tipo: 'LISTO', usuarioId: 'user-2', listo: true });
    expect(component.miParticipacion()?.listo).toBe(true);
  });

  it('never shows the waiting room for extrinsic sessions', async () => {
    usuario.set({ id: 'user-2', email: 'u@lab.com', nombre: 'u' });
    obtenerSesionPorId.mockResolvedValue(sesionBase({ formato: 'extrinseca' }));
    obtenerParticipantes.mockResolvedValue([]);
    fixture = TestBed.createComponent(WaitingRoomPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.ionViewWillEnter();
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/extrinsic-form/session-id', { replaceUrl: true });
    expect(abrirSala).not.toHaveBeenCalled();
  });
});
