import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { RUEDA_SABORES, TIPOS_DEFECTO } from '../../../core/cva/cva';
import { EstadoSesion } from '../../../core/models/sesion.model';
import { AuthService } from '../../../core/services/auth';
import { FichaEvaluacion, ItemCola, OfflineSyncService } from '../../../core/services/offline-sync';
import { EventoSala, RealtimeService } from '../../../core/services/realtime';
import { SesionService } from '../../../core/services/sesion';
import { CombinedFormPage } from './combined-form.page';

const ATRIBUTOS = ['fragancia', 'aroma', 'sabor', 'saborResidual', 'acidez', 'dulzor', 'sensacionEnBoca'] as const;

describe('CombinedFormPage', () => {
  let component: CombinedFormPage;
  let fixture: ComponentFixture<CombinedFormPage>;
  let eventos: Subject<EventoSala>;
  let sincronizadas: Subject<FichaEvaluacion>;

  const obtenerSesionPorId = vi.fn();
  const obtenerMuestrasCerradas = vi.fn();
  const esOrganizadorDeSesion = vi.fn();
  const createAlert = vi.fn();
  const createToast = vi.fn();
  const navigateRoot = vi.fn();
  const enviar = vi.fn();
  const guardarBorrador = vi.fn();
  const leerBorrador = vi.fn();
  const obtenerFichasEnviadas = vi.fn();
  const pendientesDeSesion = vi.fn();
  const enviarBroadcast = vi.fn();
  const cola = signal<readonly ItemCola[]>([]);

  const calificar = (valor = 5) => {
    for (const atributo of ATRIBUTOS) component.seleccionarCalidad(atributo, valor);
    component.seleccionarCalidad('impresionGlobal', valor);
  };

  const calificarTodas = () => {
    for (const respuesta of component.respuestas) {
      for (const atributo of ATRIBUTOS) respuesta.atributos[atributo].calidad = 5;
      respuesta.impresionGlobal = 5;
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    eventos = new Subject<EventoSala>();
    sincronizadas = new Subject<FichaEvaluacion>();
    cola.set([]);
    navigateRoot.mockResolvedValue(true);
    esOrganizadorDeSesion.mockResolvedValue(false);
    obtenerSesionPorId.mockResolvedValue({
      id: 'session-id',
      formato: 'combinado',
      numeroMuestras: 3,
      estado: EstadoSesion.INICIADA
    });
    obtenerMuestrasCerradas.mockResolvedValue([]);
    enviar.mockResolvedValue({ estado: 'sincronizada' });
    leerBorrador.mockReturnValue(null);
    obtenerFichasEnviadas.mockResolvedValue([]);
    pendientesDeSesion.mockReturnValue([]);
    enviarBroadcast.mockResolvedValue(true);
    createAlert.mockResolvedValue({ present: vi.fn() });
    createToast.mockResolvedValue({ present: vi.fn() });

    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'session-id' } } } },
        { provide: SesionService, useValue: { obtenerSesionPorId, obtenerMuestrasCerradas, esOrganizadorDeSesion } },
        {
          provide: AuthService,
          useValue: {
            usuario: signal({ id: 'user-id', email: 'u@lab.com', nombre: 'Ana' }),
            asegurarInicializado: vi.fn().mockResolvedValue(undefined)
          }
        },
        {
          provide: OfflineSyncService,
          useValue: {
            enLinea: signal(true),
            cola,
            rechazos: signal(new Map<string, string>()),
            sincronizadas$: sincronizadas.asObservable(),
            enviar,
            guardarBorrador,
            leerBorrador,
            obtenerFichasEnviadas,
            pendientesDeSesion,
            reintentarAhora: vi.fn()
          }
        },
        {
          provide: RealtimeService,
          useValue: {
            abrirSala: vi.fn(() => ({ eventos$: eventos.asObservable(), enviar: enviarBroadcast })),
            liberarSala: vi.fn()
          }
        },
        { provide: AlertController, useValue: { create: createAlert } },
        { provide: ToastController, useValue: { create: createToast } },
        { provide: NavController, useValue: { navigateRoot, back: vi.fn() } }
      ]
    });
    fixture = TestBed.createComponent(CombinedFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads one response per sample and starts on the first open sample', () => {
    expect(obtenerSesionPorId).toHaveBeenCalledWith('session-id');
    expect(component.totalMuestras()).toBe(3);
    expect(component.respuestas).toHaveLength(3);
    expect(component.muestraActual()).toBe(1);
  });

  it('starts without preselected hedonic ratings and with zero intensity', () => {
    for (const atributo of ATRIBUTOS) {
      expect(component.formulario.atributos[atributo].intensidad).toBe(0);
      expect(component.formulario.atributos[atributo].calidad).toBe(0);
    }
    expect(component.formulario.impresionGlobal).toBe(0);
    expect(component.puntaje).toBeNull();
  });

  it('calculates only after all hedonic ratings are selected and ignores intensity', () => {
    component.seleccionarCalidad('fragancia', 5);
    expect(component.puntaje).toBeNull();

    calificar(5);
    expect(component.puntaje).toBe(79);

    component.formulario.atributos.fragancia.intensidad = 12;
    expect(component.puntaje).toBe(79);

    component.seleccionarCalidad('fragancia', 6);
    expect(component.puntaje).toBe(79.75);
  });

  it('rounds the score to the nearest quarter point and subtracts defect penalties', () => {
    calificar(5);
    component.seleccionarCalidad('fragancia', 9);
    component.formulario.defectos.tazasNoUniformes = 1;

    expect(component.puntaje).toBe(79.75);
  });

  it('applies one defective-cup penalty when a defect type is selected', () => {
    calificar(5);
    component.toggleTipoDefecto('Papel / Mohoso');

    expect(component.totalTazasDefectuosas).toBe(1);
    expect(component.puntaje).toBe(75);
  });

  it('saves a draft under borrador_sesion_{id}_{muestra} on every interaction', async () => {
    component.seleccionarCalidad('fragancia', 7);
    component.alInteractuar();
    await Promise.resolve();

    expect(guardarBorrador).toHaveBeenCalledWith('session-id', 1, component.formulario);
  });

  it('restores a local draft over an empty form', async () => {
    leerBorrador.mockImplementation((_sesion: string, muestra: number) =>
      muestra === 2 ? { ...component.crearFormularioVacio(), impresionGlobal: 7 } : null
    );
    await component.ngOnInit();

    expect(component.respuestas[1].impresionGlobal).toBe(7);
  });

  it('requires a complete sample before advancing and sends it when complete', async () => {
    component.seleccionarCalidad('fragancia', 8);
    await component.irAMuestraSiguiente();
    expect(component.muestraActual()).toBe(1);
    expect(enviar).not.toHaveBeenCalled();
    expect(createToast).toHaveBeenCalledWith(expect.objectContaining({ color: 'warning' }));

    calificar(5);
    await component.irAMuestraSiguiente();
    expect(enviar).toHaveBeenCalledWith(expect.objectContaining({
      sesionId: 'session-id',
      catadorId: 'user-id',
      numeroMuestra: 1,
      impresionGlobal: 5,
      puntajeFinal: 79
    }));
    expect(component.muestraActual()).toBe(2);
  });

  it('maps attribute keys so the database CHECK accepts them', async () => {
    calificar(5);
    await component.irAMuestraSiguiente();

    const ficha = enviar.mock.calls[0][0] as FichaEvaluacion;
    const nombres = ficha.atributos.map(a => a.atributo);
    expect(nombres).toContain('saborResidual');
    expect(nombres).toContain('sensacionEnBoca');
    expect(ficha.atributos).toHaveLength(7);
  });

  it('blocks finishing while any open sample is incomplete', async () => {
    await component.finalizarCata();

    const alertOptions = createAlert.mock.calls[0][0];
    expect(alertOptions.header).toBe('Cata incompleta');
    expect(alertOptions.message).toContain('3 muestra(s) sin calificar');
  });

  it('does not require samples closed by the organizer', async () => {
    eventos.next({ tipo: 'MUESTRA_CERRADA', numeroMuestra: 3 });
    await fixture.whenStable();
    for (const respuesta of component.respuestas.slice(0, 2)) {
      for (const atributo of ATRIBUTOS) respuesta.atributos[atributo].calidad = 5;
      respuesta.impresionGlobal = 5;
    }

    await component.finalizarCata();

    const alertOptions = createAlert.mock.calls[0][0];
    expect(alertOptions.header).toBe('Finalizar cata');
  });

  it('sends every open sample and navigates when all are synchronized', async () => {
    calificarTodas();
    await component.finalizarCata();
    const alertOptions = createAlert.mock.calls[0][0];
    await alertOptions.buttons[1].handler();

    expect(enviar).toHaveBeenCalledTimes(3);
    expect(navigateRoot).toHaveBeenCalledWith('/session/session-id/evaluation-complete?organizador=0');
  });

  it('keeps the user on the form with "saved locally" when offline', async () => {
    enviar.mockResolvedValue({ estado: 'pendiente', mensaje: 'Guardado localmente. Reintentando…' });
    calificarTodas();
    await component.finalizarCata();
    await createAlert.mock.calls[0][0].buttons[1].handler();

    expect(component.esperandoSincronizacion()).toBe(true);
    expect(navigateRoot).not.toHaveBeenCalled();
  });

  it('shows the server rejection and does not navigate', async () => {
    enviar.mockResolvedValueOnce({ estado: 'rechazada', mensaje: 'La muestra fue cerrada.' });
    calificarTodas();
    await component.finalizarCata();
    await createAlert.mock.calls[0][0].buttons[1].handler();

    const rechazo = createAlert.mock.calls[1][0];
    expect(rechazo.header).toBe('Muestra 1 no guardada');
    expect(navigateRoot).not.toHaveBeenCalled();
  });

  it('jumps to the sample requested by the organizer (CAMBIAR_MUESTRA)', async () => {
    eventos.next({ tipo: 'CAMBIAR_MUESTRA', numeroMuestra: 3 });
    await fixture.whenStable();

    expect(component.muestraActual()).toBe(3);
  });

  it('announces each synchronized sheet to the organizer', async () => {
    sincronizadas.next({
      sesionId: 'session-id', catadorId: 'user-id', numeroMuestra: 1, impresionGlobal: 5,
      tazasNoUniformes: 0, tazasDefectuosas: 0, puntajeFinal: 79, notas: null, atributos: []
    });
    await fixture.whenStable();

    expect(enviarBroadcast).toHaveBeenCalledWith({ tipo: 'EVALUACION_ENVIADA', usuarioId: 'user-id', numeroMuestra: 1 });
    expect(component.muestrasEnviadas().has(1)).toBe(true);
  });

  it('redirects to the waiting room if the session has not started', async () => {
    obtenerSesionPorId.mockResolvedValue({ id: 'session-id', formato: 'combinado', numeroMuestras: 3, estado: EstadoSesion.EN_ESPERA });
    navigateRoot.mockClear();
    fixture = TestBed.createComponent(CombinedFormPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateRoot).toHaveBeenCalledWith('/session/waiting/session-id');
  });

  it('keeps negative flavor descriptors out of the positive flavor wheel', () => {
    expect(RUEDA_SABORES['Otro'].subdescriptores).toEqual(['Madera', 'Tinta', 'Caucho']);
    expect(TIPOS_DEFECTO).toEqual(['Mohoso / Terroso', 'Fenólico', 'Papa', 'Papel / Mohoso', 'Químico']);
  });

  it('uses the full CVA hedonic scale labels', () => {
    expect(component.etiquetas[5]).toBe('Ni alto ni bajo');
    expect(component.etiquetas[1]).toBe('Extremadamente baja');
    expect(component.etiquetas[9]).toBe('Extremadamente alta');
  });
});
