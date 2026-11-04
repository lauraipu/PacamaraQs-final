import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { SampleConsolidatedResult, SessionResults } from '../../../core/models/session-results.model';
import { ResultsService } from '../../../core/services/results';
import { ImpresionService } from '../../../core/services/impresion';
import { clasificarPuntaje, etiquetaHedonica, ResultsPage } from './results.page';

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
  ],
  atributosPorMuestra: [],
  votosHedonicos: [],
  fichasTecnicas: []
});

const ficha = (numeroMuestra: number, puntaje: number, atributos = {}) => ({
  numeroMuestra, puntaje, defectos: [], tazasNoUniformes: 0, tazasDefectuosas: 0, impresionGlobal: null, atributos
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

describe('etiquetaHedonica', () => {
  it('rounds the average to the nearest point of the 9-point scale', () => {
    expect(etiquetaHedonica(7.67)).toBe('Muy alta');
    expect(etiquetaHedonica(5.2)).toBe('Ni alto ni bajo');
    expect(etiquetaHedonica(null)).toBe('Sin votos');
  });
});

describe('ResultsPage', () => {
  const obtenerResultadosSesion = vi.fn();
  const imprimir = vi.fn().mockResolvedValue(undefined);
  const navigateForward = vi.fn();
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
        { provide: ImpresionService, useValue: { imprimir } },
        { provide: NavController, useValue: { navigateRoot: vi.fn(), navigateForward } },
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

  it('defaults the sample gauge to the top-ranked sample and follows the selection', async () => {
    obtenerResultadosSesion.mockResolvedValue(resultadosBase([muestra(1, 82), muestra(2, 88.5), muestra(3, 85)]));

    const component = await crear();

    expect(component.esCombinado()).toBe(true);
    expect(component.muestraEnMedidor()?.numeroMuestra).toBe(2);
    component.seleccionarMuestraMedidor(3);
    expect(component.muestraEnMedidor()?.numeroMuestra).toBe(3);
    component.seleccionarMuestraMedidor(99);
    expect(component.muestraEnMedidor()?.numeroMuestra).toBe(2);
  });

  it('places the gauge needle on the semicircle (0 left, 50 top, 100 right)', async () => {
    obtenerResultadosSesion.mockResolvedValue(resultadosBase([muestra(1, 50)]));

    const component = await crear();

    expect(component.agujaPanel()).toEqual({ x: 100, y: 40 });
  });

  it('opens the individual report on the first taster who submitted', async () => {
    const base = resultadosBase([muestra(1, 84)]);
    base.catadores = [
      { ...base.catadores[1], puntajesPorMuestra: [] },
      {
        ...base.catadores[0],
        puntajesPorMuestra: [
          ficha(2, 84.99),
          { ...ficha(1, 86.22, { aroma: { intensidad: 9, calidad: 8.5 }, sabor: { intensidad: null, calidad: 8.75 } }), tazasNoUniformes: 1 }
        ]
      }
    ];
    obtenerResultadosSesion.mockResolvedValue(base);

    const component = await crear();

    expect(component.catadorReporte()?.cupperId).toBe('a');
    expect(component.fichasReporte().map(f => [f.numeroMuestra, f.clasificacion.etiqueta]))
      .toEqual([[1, 'Excelente'], [2, 'Muy bueno']]);
    expect(component.fichasReporte()[0].atributos.map(a => [a.etiqueta, a.intensidad, a.calidad]))
      .toEqual([['Aroma', 9, 8.5], ['Sabor', null, 8.75]]);
    component.seleccionarCatadorReporte('b');
    expect(component.catadorReporte()?.cupperId).toBe('b');
    expect(component.fichasReporte()).toEqual([]);
  });

  it('preselects sample and taster when exporting from an individual sheet', async () => {
    obtenerResultadosSesion.mockResolvedValue(resultadosBase([muestra(1, 84)]));

    const component = await crear();
    component.abrirExportar({ numeroMuestra: 1, cupperId: 'a' });

    expect(component.modalExportarAbierto()).toBe(true);
    expect(component.modoExportacion()).toBe('catador');
    expect(component.muestraExportar()).toBe(1);
    expect(component.catadorExportarId()).toBe('a');
  });

  it('does not enable the combined layout for other formats', async () => {
    obtenerResultadosSesion.mockResolvedValue({ ...resultadosBase([muestra(1, 84)]), formatoCva: 'afectivo' });

    const component = await crear();

    expect(component.esCombinado()).toBe(false);
  });

  it('builds the hedonic summary and vote distribution for affective sessions', async () => {
    obtenerResultadosSesion.mockResolvedValue({
      ...resultadosBase([muestra(1, 80), muestra(2, 82)]),
      formatoCva: 'afectivo',
      votosHedonicos: [
        { numeroMuestra: 1, valor: 7, votos: 2 },
        { numeroMuestra: 1, valor: 9, votos: 1 },
        { numeroMuestra: 2, valor: 8, votos: 3 }
      ],
      atributosPorMuestra: [
        { numeroMuestra: 1, atributo: 'acidez', respuestas: 3, intensidadPromedio: null, calidadPromedio: 6.5 }
      ]
    });

    const component = await crear();

    expect(component.esAfectivo()).toBe(true);
    expect(component.esCombinado()).toBe(false);
    const filas = component.resultadosHedonicos();
    expect(filas.map(f => [f.numeroMuestra, f.posicion, f.promedio])).toEqual([[2, 1, 8], [1, 2, 7.67]]);
    const m1 = filas.find(f => f.numeroMuestra === 1)!;
    expect(m1.totalVotos).toBe(3);
    expect(m1.distribucion.map(d => d.votos)).toEqual([1, 0, 2, 0, 0, 0, 0, 0, 0]);
    expect(m1.etiqueta).toBe('Muy alta');
    expect(m1.atributos.find(a => a.clave === 'acidez')?.valor).toBe(6.5);
    expect(component.hedonicoSeleccionado()?.numeroMuestra).toBe(2);
    component.seleccionarMuestraDetalle(1);
    expect(component.hedonicoSeleccionado()?.numeroMuestra).toBe(1);
  });

  it('builds the intensity profile without quality scores for descriptive sessions', async () => {
    const base = resultadosBase([muestra(1, 0, { evaluacionesRecibidas: 0 }), muestra(2, 0, { evaluacionesRecibidas: 0 })]);
    base.catadores[0].puntajesPorMuestra = [ficha(1, 0), ficha(2, 0)];
    base.catadores[1].puntajesPorMuestra = [ficha(1, 0)];
    obtenerResultadosSesion.mockResolvedValue({
      ...base,
      formatoCva: 'descriptivo',
      atributosPorMuestra: [
        { numeroMuestra: 1, atributo: 'sabor', respuestas: 2, intensidadPromedio: 7.5, calidadPromedio: null },
        { numeroMuestra: 2, atributo: 'sabor', respuestas: 1, intensidadPromedio: 15, calidadPromedio: null }
      ]
    });

    const component = await crear();

    expect(component.esDescriptivo()).toBe(true);
    const [p1, p2] = component.perfilesDescriptivos();
    expect(p1.fichas).toBe(2);
    expect(p2.fichas).toBe(1);
    expect(p1.atributos.find(a => a.clave === 'sabor')).toMatchObject({ valor: 7.5, porcentaje: 50 });
    expect(p2.atributos.find(a => a.clave === 'sabor')?.porcentaje).toBe(100);
    expect(p1.atributos.find(a => a.clave === 'acidez')).toMatchObject({ valor: null, porcentaje: 0 });
  });

  it('flags extrinsic sessions and names the printed document after the session', async () => {
    obtenerResultadosSesion.mockResolvedValue({ ...resultadosBase([muestra(1, 0)]), formatoCva: 'extrinseca' });

    const component = await crear();

    expect(component.esExtrinseco()).toBe(true);
    expect(component.tituloReporte()).toBe('Ficha técnica - Cosecha - Extrínseca');
  });

  it('names the combined report after the exported sample and taster', async () => {
    obtenerResultadosSesion.mockResolvedValue(resultadosBase([muestra(1, 84), muestra(2, 86)]));

    const component = await crear();
    component.abrirExportar({ numeroMuestra: 1, cupperId: 'a' });

    expect(component.tituloReporte()).toBe('Reporte SCA - Cosecha - Combinado - Muestra 1 - Ana');
  });

  it('shows the reserved-results state when the server denies access (42501)', async () => {
    obtenerResultadosSesion.mockRejectedValue({ code: '42501', message: 'Solo el organizador puede ver los resultados.' });

    const component = await crear();

    expect(component.accesoDenegado()).toBe(true);
    expect(component.error()).toBe('Solo el organizador puede ver los resultados.');
    expect(component.resultados()).toBeNull();
  });

  it('flags an open panel (22023) so the organizer can go finalize it', async () => {
    obtenerResultadosSesion.mockRejectedValue({ code: '22023', message: 'Los resultados están disponibles cuando el panel se cierra.' });

    const component = await crear();

    expect(component.panelAbierto()).toBe(true);
    expect(component.accesoDenegado()).toBe(false);
    component.irAMonitoreo();
    expect(navigateForward).toHaveBeenCalledWith('/session/session-id/organizer-dashboard');
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
