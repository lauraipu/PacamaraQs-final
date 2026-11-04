import {
  calcularPuntajeCva, canonizarDescriptores, extraerJson, parsearNumeroEs, payloadFichaPersonal, respuestaSimulada,
  sanearCalidad, sanearFicha, sanearGustos, sanearIntensidad, sanearNumeroPositivo
} from './ficha-escaneada';

describe('gustos predominantes y números', () => {
  it('keeps at most two valid tastes, accent-insensitive', () => {
    expect(sanearGustos(['Ácido', 'dulce', 'umami', 'picante'])).toEqual(['acido', 'dulce']);
    expect(sanearGustos('dulce')).toEqual([]);
  });

  it('parses Colombian number formats and rejects letters', () => {
    expect(parsearNumeroEs('25.000')).toBe(25000);
    expect(parsearNumeroEs('$ 25.000,50')).toBe(25000.5);
    expect(parsearNumeroEs('12,5')).toBe(12.5);
    expect(parsearNumeroEs('12.5')).toBe(12.5);
    expect(parsearNumeroEs('12a')).toBeNull();
    expect(parsearNumeroEs('')).toBeNull();
    expect(sanearNumeroPositivo(-3)).toBeNull();
    expect(sanearNumeroPositivo('690')).toBe(690);
  });
});

describe('extraerJson', () => {
  it('accepts fenced JSON and rejects free text', () => {
    expect(extraerJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    let mensaje = '';
    try { extraerJson('no hay datos'); } catch (e) { mensaje = (e as Error).message; }
    expect(mensaje).toBe('La IA no devolvió un JSON válido.');
  });
});

describe('sanitizing values', () => {
  it('clamps intensity to 0–15 in 0.5 steps and quality to integers 1–9', () => {
    expect(sanearIntensidad(7.3)).toBe(7.5);
    expect(sanearIntensidad('16')).toBe(15);
    expect(sanearIntensidad('8,5')).toBe(8.5);
    expect(sanearIntensidad(null)).toBeNull();
    expect(sanearCalidad(8.4)).toBe(8);
    expect(sanearCalidad(0)).toBeNull();
    expect(sanearCalidad(12)).toBeNull();
  });

  it('maps SCA sheet labels to the app vocabulary and keeps unknown words', () => {
    expect(canonizarDescriptores(['Nueces/Cacao', 'Verde/Vegetal', 'cacao', 'Grosella', 'cacao'])).toEqual(['Nueces / Cacao', 'Verde / Vegetal', 'Cacao', 'Grosella']);
  });
});

describe('sanearFicha', () => {
  it('keeps unreadable values as null (never 0) and lists them for review', () => {
    const ficha = sanearFicha({ atributos: { fragancia: { intensidad: 9, calidad: 8, descriptores: ['Floral'] } }, impresionGlobal: null }, 'combinado', false);
    expect(ficha.atributos[0]).toEqual({ atributo: 'fragancia', etiqueta: 'Fragancia', intensidad: 9, calidad: 8 });
    expect(ficha.atributos[1].intensidad).toBeNull();
    expect((ficha.formulario['atributos'] as Record<string, { intensidad: unknown }>)['aroma'].intensidad).toBeNull();
    expect(ficha.camposFaltantes).toContain('Aroma · intensidad');
    expect(ficha.camposFaltantes).toContain('Impresión global');
    expect(ficha.puntaje).toBeNull();
    expect(payloadFichaPersonal(ficha)['atributos']).toEqual([{ atributo: 'fragancia', intensidad: 9, calidad: 8 }]);
  });

  it('computes the CVA score like the forms and the server', () => {
    const ficha = sanearFicha(respuestaSimulada('combinado'), 'combinado', true);
    expect(ficha.simulada).toBe(true);
    expect(ficha.camposFaltantes).toEqual([]);
    expect(ficha.puntaje).toBe(calcularPuntajeCva([8, 8, 8, 7, 8, 8, 7], 8, 0, 0));
    expect(calcularPuntajeCva([8, 8, 9, 8, 8, 8, 8], 8, 0, 0)).toBe(95.5);
  });

  it('a defect type forces at least one defective cup', () => {
    const ficha = sanearFicha({ ...respuestaSimulada('combinado'), tiposDefecto: ['Fenólico'], tazasDefectuosas: 0 }, 'combinado', false);
    expect(ficha.tazasDefectuosas).toBe(1);
  });

  it('builds the affective and extrinsic form shapes', () => {
    const afectivo = sanearFicha(respuestaSimulada('afectivo'), 'afectivo', true);
    expect(afectivo.formulario['fragancia']).toBe(8);
    expect(afectivo.atributos.every(a => a.intensidad === null)).toBe(true);
    const ext = sanearFicha({ processing: { processType: 'Honey' }, farming: { country: 'Colombia' } }, 'extrinseca', false);
    expect((ext.formulario['processing'] as Record<string, unknown>)['processType']).toBe('');
    expect(ext.camposFaltantes).toEqual(['Variedad']);
    expect(ext.atributos).toEqual([]);
  });
});
