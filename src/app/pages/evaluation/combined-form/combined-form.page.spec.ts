import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { RUEDA_SABORES, TIPOS_DEFECTO } from '../../../core/cva/cva';
import { SesionService } from '../../../core/services/sesion';
import { CombinedFormPage } from './combined-form.page';

describe('CombinedFormPage', () => {
  let component: CombinedFormPage;
  let fixture: ComponentFixture<CombinedFormPage>;
  const obtenerSesionPorId = vi.fn();
  const createAlert = vi.fn();
  const createToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    obtenerSesionPorId.mockResolvedValue({
      id: 'session-id',
      numeroMuestras: 3
    });
    createAlert.mockResolvedValue({ present: vi.fn() });
    createToast.mockResolvedValue({ present: vi.fn() });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } }
        },
        { provide: SesionService, useValue: { obtenerSesionPorId } },
        { provide: AlertController, useValue: { create: createAlert } },
        { provide: ToastController, useValue: { create: createToast } }
      ]
    });
    fixture = TestBed.createComponent(CombinedFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts without preselected hedonic ratings and with zero intensity', () => {
    expect(component.formulario.atributos.fragancia.intensidad).toBe(0);
    expect(component.formulario.atributos.aroma.intensidad).toBe(0);
    expect(component.formulario.atributos.sabor.intensidad).toBe(0);
    expect(component.formulario.atributos.saborResidual.intensidad).toBe(0);
    expect(component.formulario.atributos.acidez.intensidad).toBe(0);
    expect(component.formulario.atributos.dulzor.intensidad).toBe(0);
    expect(component.formulario.atributos.sensacionEnBoca.intensidad).toBe(0);
    expect(component.formulario.atributos.fragancia.calidad).toBe(0);
    expect(component.formulario.atributos.fragancia.extra).toBe('');
    expect(component.formulario.impresionGlobal).toBe(0);
    expect(component.puntaje).toBeNull();
  });

  it('calculates only after all hedonic ratings are selected and ignores intensity', () => {
    component.seleccionarCalidad('fragancia', 5);
    expect(component.puntaje).toBeNull();

    component.seleccionarCalidad('aroma', 5);
    component.seleccionarCalidad('sabor', 5);
    component.seleccionarCalidad('saborResidual', 5);
    component.seleccionarCalidad('acidez', 5);
    component.seleccionarCalidad('dulzor', 5);
    component.seleccionarCalidad('sensacionEnBoca', 5);
    component.seleccionarCalidad('impresionGlobal', 5);
    const puntajeInicial = component.puntaje;
    expect(puntajeInicial).toBe(79);

    component.formulario.atributos.fragancia.intensidad = 12;
    expect(component.puntaje).toBe(puntajeInicial);

    component.seleccionarCalidad('fragancia', 6);
    expect(component.puntaje).toBe(79.75);
  });

  it('rounds the score to the nearest quarter point and subtracts defect penalties', () => {
    for (const atributo of ['fragancia', 'aroma', 'sabor', 'saborResidual', 'acidez', 'dulzor', 'sensacionEnBoca'] as const) {
      component.seleccionarCalidad(atributo, 5);
    }
    component.seleccionarCalidad('impresionGlobal', 5);
    component.seleccionarCalidad('fragancia', 9);
    component.formulario.defectos.tazasNoUniformes = 1;

    expect(component.puntaje).toBe(79.75);
  });

  it('requires a complete sample before advancing and preserves responses while navigating', async () => {
    const route = TestBed.inject(ActivatedRoute);
    vi.spyOn(route.snapshot.paramMap, 'get').mockReturnValue('session-id');

    await component.ngOnInit();
    expect(obtenerSesionPorId).toHaveBeenCalledWith('session-id');
    expect(component.totalMuestras).toBe(3);
    expect(component.respuestas).toHaveLength(3);

    component.seleccionarCalidad('fragancia', 8);
    component.irAMuestraSiguiente();
    expect(component.muestraActual).toBe(1);
    expect(createToast).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Por favor, califica todos los atributos de esta muestra antes de continuar.',
      color: 'warning'
    }));

    for (const atributo of ['aroma', 'sabor', 'saborResidual', 'acidez', 'dulzor', 'sensacionEnBoca'] as const) {
      component.seleccionarCalidad(atributo, 5);
    }
    component.seleccionarCalidad('impresionGlobal', 5);
    component.irAMuestraSiguiente();
    expect(component.muestraActual).toBe(2);
    expect(component.formulario.atributos.fragancia.calidad).toBe(0);

    for (const atributo of ['fragancia', 'aroma', 'sabor', 'saborResidual', 'acidez', 'dulzor', 'sensacionEnBoca'] as const) {
      component.seleccionarCalidad(atributo, 5);
    }
    component.seleccionarCalidad('impresionGlobal', 5);
    component.irAMuestraAnterior();
    expect(component.formulario.atributos.fragancia.calidad).toBe(8);
  });

  it('keeps negative flavor descriptors out of the positive flavor wheel', () => {
    expect(RUEDA_SABORES['Otro'].subdescriptores).toEqual(['Madera', 'Tinta', 'Caucho']);
    expect(TIPOS_DEFECTO).toEqual([
      'Mohoso / Terroso',
      'Fenólico',
      'Papa',
      'Papel / Mohoso',
      'Químico'
    ]);
  });

  it('applies one defective-cup penalty when a defect type is selected', () => {
    for (const atributo of ['fragancia', 'aroma', 'sabor', 'saborResidual', 'acidez', 'dulzor', 'sensacionEnBoca'] as const) {
      component.seleccionarCalidad(atributo, 5);
    }
    component.seleccionarCalidad('impresionGlobal', 5);
    component.toggleTipoDefecto('Papel / Mohoso');

    expect(component.totalTazasDefectuosas).toBe(1);
    expect(component.puntaje).toBe(75);

    component.formulario.defectos.tazasDefectuosas = 2;
    expect(component.totalTazasDefectuosas).toBe(2);
  });

  it('blocks finishing while any sample is incomplete', async () => {
    component.respuestas = Array.from({ length: 3 }, () => component.crearFormularioVacio());
    await component.finalizarCata();

    const alertOptions = createAlert.mock.calls[0][0];
    expect(alertOptions.header).toBe('Cata incompleta');
    expect(alertOptions.message).toContain('3 muestra(s) sin calificar');
    expect(alertOptions.buttons).toEqual(['Entendido']);
    expect(createAlert).toHaveBeenCalledTimes(1);
  });

  it('warns that results are not persisted when all samples are complete', async () => {
    for (const respuesta of component.respuestas) {
      respuesta.atributos.fragancia.calidad = 5;
      respuesta.atributos.aroma.calidad = 5;
      respuesta.atributos.sabor.calidad = 5;
      respuesta.atributos.saborResidual.calidad = 5;
      respuesta.atributos.acidez.calidad = 5;
      respuesta.atributos.dulzor.calidad = 5;
      respuesta.atributos.sensacionEnBoca.calidad = 5;
      respuesta.impresionGlobal = 5;
    }

    await component.finalizarCata();

    const alertOptions = createAlert.mock.calls[0][0];
    expect(alertOptions.message).toContain('no existe guardado en el servidor');
    expect(alertOptions.buttons.map((button: { text: string }) => button.text))
      .toContain('Salir sin guardar');
  });

  it('reports a missing session ID from the route', async () => {
    await component.ngOnInit();

    expect(component.error).toBe('No se encontró el ID de la sesión.');
    expect(obtenerSesionPorId).not.toHaveBeenCalled();
  });

  it('uses the full CVA hedonic scale labels', () => {
    expect(component.etiquetas[5]).toBe('Ni alto ni bajo');
    expect(component.etiquetas[1]).toBe('Extremadamente baja');
    expect(component.etiquetas[9]).toBe('Extremadamente alta');
  });
});
