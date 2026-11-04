import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { SampleConsolidatedResult, SessionResults } from '../../../core/models/session-results.model';
import { ResultsService } from '../../../core/services/results';
import { clasificarPuntaje, ResultsPage } from './results.page';

const muestra = (numeroMuestra: number, puntaje: number, cambios: Partial<SampleConsolidatedResult> = {}): SampleConsolidatedResult => ({
  numeroMuestra,
  nivelTueste: null,
  puntajePromedioPanel: puntaje,
  puntajeMin: puntaje - 1,
  puntajeMax: puntaje + 1,
  desviacionEstandar: 0.5,
  evaluacionesRecibidas: 3,
  evaluacionesEsperadas: 3,
  recortado: false,
  puntajePromedioSimple: puntaje,
  cerradaForzada: false,
  ...cambios
});

const resultadosBase = (muestras: SampleConsolidatedResult[]): SessionResults => ({
  sesionId: 'session-id',
  nombreSesion: 'Cosecha',
  formatoCva: 'combinado',
  fechaCierre: '2026-11-04T00:00:00.000Z',
  totalMuestras: muestras.length,
  totalCatadores: 2,
  muestras,
  catadores: [
    {
      cupperId: 'a', nombre: 'Ana', esOrganizador: false, muestrasEvaluadas: 3, muestrasAsignadas: 3,
      estado: 'enviado', submittedAt: null, puntajePromedio: 84, desviacionRespectoPanel: 0, puntajesPorMuestra: []
    },
    {
      cupperId: 'b', nombre: 'Beto', esOrganizador: false, muestrasEvaluadas: 1, muestrasAsignadas: 3,
      estado: 'pendiente', submittedAt: null, puntajePromedio: 80, desviacionRespectoPanel: -1, puntajesPorMuestra: []
    }
  ]
});

describe('clasificarPuntaje', () => {
  it.each([
    [92, 'Excepcional'],
    [90, 'Excepcional'],
    [87.5, 'Excelente'],
    [80, 'Muy bueno'],
    [76, 'Bueno'],
    [74.99, 'Regular']
  ])('classifies %d as %s', (puntaje, etiqueta) => {
    expect(clasificarPuntaje(puntaje).etiqueta).toBe(etiqueta);
  });
});

describe('ResultsPage', () => {
  const obtenerResultadosSesion = vi.fn();
  let sesionId: string | null = 'session-id';

  const crear = async (): Promise<ResultsPage> => {
    const component = TestBed.createComponent(ResultsPage).componentInstance;
    await component.ngOnInit();
    return component;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sesionId = 'session-id';
    TestBed.configureTestingModule({
      imports: [ResultsPage],
      providers: [
        { provide: ResultsService, useValue: { obtenerResultadosSesion } },
        { provide: NavController, useValue: { navigateRoot: vi.fn() } },
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { get paramMap() { return convertToParamMap(sesionId ? { id: sesionId } : {}); } } }
        }
      ]
    });
  });

  it('ranks samples by panel score and leaves out samples without sheets', async () => {
    obtenerResultadosSesion.mockResolvedValue(resultadosBase([
      muestra(1, 82),
      muestra(2, 88.5, { recortado: true, puntajePromedioSimple: 88.1 }),
      muestra(3, 0, { evaluacionesRecibidas: 0, cerradaForzada: true })
    ]));

    const component = await crear();

    expect(obtenerResultadosSesion).toHaveBeenCalledWith('session-id');
    expect(component.cargando()).toBe(false);
    expect(component.ranking().map(f => [f.numeroMuestra, f.posicion])).toEqual([[2, 1], [1, 2]]);
    expect(component.ranking()[0].clasificacion.etiqueta).toBe('Excelente');
    expect(component.muestrasSinFichas().map(m => m.numeroMuestra)).toEqual([3]);
    expect(component.promedioPanel()).toBe(85.25);
    expect(component.hayRecorte()).toBe(true);
    expect(component.porcentajeCompletado()).toBe(50);
    expect(component.tituloFormato()).toBe('Combinado');
  });

  it('reports simple averages when no sample was trimmed', async () => {
    obtenerResultadosSesion.mockResolvedValue(resultadosBase([muestra(1, 80), muestra(2, 81)]));

    const component = await crear();

    expect(component.hayRecorte()).toBe(false);
    expect(component.promedioPanel()).toBe(80.5);
  });

  it('shows the reserved-results state when the server denies access (42501)', async () => {
    obtenerResultadosSesion.mockRejectedValue({ code: '42501', message: 'Solo el organizador puede ver los resultados.' });

    const component = await crear();

    expect(component.accesoDenegado()).toBe(true);
    expect(component.error()).toBe('Solo el organizador puede ver los resultados.');
    expect(component.resultados()).toBeNull();
  });

  it('shows a not-found message when the session has no results', async () => {
    obtenerResultadosSesion.mockResolvedValue(null);

    const component = await crear();

    expect(component.accesoDenegado()).toBe(false);
    expect(component.error()).toBe('No se encontraron resultados para esta sesión.');
  });

  it('does not query the server without a session id', async () => {
    sesionId = null;

    const component = await crear();

    expect(obtenerResultadosSesion).not.toHaveBeenCalled();
    expect(component.error()).toBe('No se encontró el ID de la sesión.');
    expect(component.cargando()).toBe(false);
  });
});
