import {
  casillasDeBoca, casillasDeDefectos, casillasDeDescriptores, circuloMarcado, consolidarFichas, leerFichaSca,
  mayoria, puntajePanel
} from './hoja-sca';

type Ficha = Parameters<typeof leerFichaSca>[0];

const fichaCombinado = (cambios: Partial<Ficha> = {}, formulario: Record<string, unknown> = {}): Ficha => ({
  numeroMuestra: 1,
  puntaje: 84.5,
  defectos: [],
  tazasNoUniformes: 0,
  tazasDefectuosas: 0,
  impresionGlobal: 8,
  atributos: { fragancia: { intensidad: 13, calidad: 8 } },
  formulario: {
    atributos: {
      fragancia: { intensidad: 13, calidad: 8, descriptores: ['Lavanda', 'Almendra'], extra: 'jazmín suave' },
      aroma: { intensidad: 11, calidad: 7, descriptores: ['Chocolate'], extra: '' },
      sabor: { intensidad: 12.5, calidad: 8, descriptores: ['Miel'], extra: '' },
      saborResidual: { intensidad: 12, calidad: 7, descriptores: [], extra: '' },
      acidez: { intensidad: 9, calidad: 8 },
      dulzor: { intensidad: 10, calidad: 8 },
      sensacionEnBoca: { intensidad: 8, calidad: 7 }
    },
    impresionGlobal: 8,
    mouthfeel: ['Suave (aterciopelado, sedoso)', 'Astringente (deja seca la boca)'],
    notasMouthfeel: 'cuerpo medio',
    tiposDefecto: ['Fenólico', 'Químico'],
    notas: 'Taza limpia',
    ...formulario
  },
  ...cambios
});

describe('casillasDeDescriptores', () => {
  it('maps app descriptors to SCA boxes, marking the category of every sub-descriptor', () => {
    const casillas = casillasDeDescriptores(['Lavanda', 'Almendra', 'Chocolate', 'Miel', 'Pipa', 'Coco']);
    expect([...casillas].sort()).toEqual([
      'afrutado', 'dulce', 'dulce.azucar_morena', 'floral', 'nueces_cacao', 'nueces_cacao.cacao',
      'nueces_cacao.nueces', 'tostado', 'tostado.tabaco'
    ]);
  });

  it('accepts category names and ignores unknown words', () => {
    expect([...casillasDeDescriptores(['Especias', 'algo raro'])]).toEqual(['especias']);
  });
});

describe('casillasDeBoca / casillasDeDefectos', () => {
  it('reads combined and descriptive texture labels', () => {
    expect([...casillasDeBoca(['Áspero (arenoso, rugoso)', 'Astringente', 'Metálico'])]).toEqual(['aspero', 'astringente', 'metalico']);
  });
  it('maps defect types to the three SCA boxes', () => {
    expect([...casillasDeDefectos(['Mohoso / Terroso', 'Papel / Mohoso', 'Papa', 'Químico'])]).toEqual(['mohoso', 'papa']);
  });
});

describe('leerFichaSca', () => {
  it('prefers database intensities and falls back to the form JSON', () => {
    const f = leerFichaSca(fichaCombinado({ atributos: { fragancia: { intensidad: 14, calidad: 9 } } }));
    expect(f.intensidad.fragancia).toBe(14);
    expect(f.calidad.fragancia).toBe(9);
    expect(f.intensidad.sabor_residual).toBe(12);
    expect(f.calidad.sensacion_boca).toBe(7);
    expect(f.olfativo.has('floral')).toBe(true);
    expect(f.olfativo.has('nueces_cacao.cacao')).toBe(true);
    expect(f.gustativo.has('dulce.azucar_morena')).toBe(true);
    expect([...f.boca]).toEqual(['suave', 'astringente']);
    expect([...f.defectos]).toEqual(['fenolico']);
    expect(f.notas.olfativo).toBe('Descriptores: Lavanda, Almendra, Chocolate · jazmín suave');
    expect(f.notas.boca).toBe('cuerpo medio');
    expect(f.notas.otras).toBe('Taza limpia · Otros defectos: Químico');
    expect(f.puntaje).toBe(84.5);
  });

  it('reads the descriptive form (attributes at the root, texture and notes per attribute)', () => {
    const f = leerFichaSca(fichaCombinado({ atributos: {}, impresionGlobal: null, puntaje: 0 }, {
      atributos: undefined,
      fragancia: { intensidad: 7.5, descriptores: ['Cítricos'], extra: '' },
      acidez: { intensidad: 11, nota: 'cítrica brillante' },
      sensacionEnBoca: { intensidad: 6, textura: ['Aceitoso'] },
      mouthfeel: undefined, impresionGlobal: undefined
    }));
    expect(f.intensidad.fragancia).toBe(7.5);
    expect(f.calidad.fragancia).toBeNull();
    expect(f.olfativo.has('afrutado.citricos')).toBe(true);
    expect(f.notas.acidez).toBe('cítrica brillante');
    expect([...f.boca]).toEqual(['aceitoso']);
    expect(f.impresionGlobal).toBeNull();
    expect(f.puntaje).toBeNull();
  });
});

describe('panel consolidation', () => {
  it('uses strict majority (> 50 %) for boxes', () => {
    const a = new Set(['floral', 'dulce']);
    const b = new Set(['floral']);
    const c = new Set(['dulce']);
    const d = new Set<string>();
    expect([...mayoria([a, b, c])].sort()).toEqual(['dulce', 'floral']);
    expect([...mayoria([a, b, c, d])]).toEqual([]);
  });

  it('averages intensities and rounds hedonic circles to the nearest integer', () => {
    const f1 = leerFichaSca(fichaCombinado());
    const f2 = leerFichaSca(fichaCombinado({ atributos: { fragancia: { intensidad: 10, calidad: 7 } }, impresionGlobal: 7 }));
    const panel = consolidarFichas([f1, f2], 'resumen');
    expect(panel.intensidad.fragancia).toBe(11.5);
    expect(panel.calidad.fragancia).toBe(7.5);
    expect(circuloMarcado(panel.calidad.fragancia)).toBe(8);
    expect(circuloMarcado(7.49)).toBe(7);
    expect(panel.impresionGlobal).toBe(7.5);
    expect(panel.olfativo.has('floral')).toBe(true);
    expect(panel.notas.acidez).toContain('Ver reporte individual');
    expect(panel.notas.otras).toBe('resumen');
  });

  it('trims the max and min score with five or more sheets, like the RPC', () => {
    expect(puntajePanel([80, 82, 84])).toBe(82);
    expect(puntajePanel([70, 82, 84, 86, 95])).toBe(84);
    expect(puntajePanel([])).toBeNull();
  });
});
