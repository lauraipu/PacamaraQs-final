import { construirFichasTecnicas, textoDeCampo } from './ficha-tecnica.mapper';

const formulario = {
  farming: { country: 'Colombia', region: 'Huila', farmName: 'La Esperanza', producers: '', species: 'Arábica', variety: 'Pacamara', harvestDate: '2026-05', other: '' },
  processing: { processorName: '', wetMill: '', dryMill: '', processType: 'lavado', other: '' },
  trading: { grade: 'Excelso', icoNumber: '', other: '' },
  certifications: { c4: false, fairTrade: true, organic: true, rainforest: false, other: 'Bird Friendly' },
  notes: '  Lote de prueba  '
};

describe('construirFichasTecnicas', () => {
  it('maps the extrinsic form stored in evaluaciones.notas', () => {
    const [ficha] = construirFichasTecnicas(
      [{ numero_muestra: 1, nombre: 'Ana', registrado_en: '2026-11-04T10:00:00Z', formulario }], []
    );
    const campo = (titulo: string, etiqueta: string) =>
      ficha.secciones.find(s => s.titulo === titulo)?.campos.find(c => c.etiqueta === etiqueta)?.valor;

    expect(ficha.numeroMuestra).toBe(1);
    expect(ficha.registradaPor).toBe('Ana');
    expect(campo('Cultivo', 'País')).toBe('Colombia');
    expect(campo('Cultivo', 'Variedad')).toBe('Pacamara');
    expect(campo('Cultivo', 'Productores')).toBe('—');
    expect(campo('Procesamiento', 'Tipo de proceso')).toBe('Lavado');
    expect(campo('Comercio', 'Precio en finca')).toBe('—');
    expect(ficha.certificaciones).toEqual(['Bird Friendly', 'Fair Trade', 'Orgánico']);
    expect(ficha.notas).toBe('Lote de prueba');
  });

  it('prefers the structured evaluacion_extrinseca row and fills gaps from the form', () => {
    const [ficha] = construirFichasTecnicas(
      [{ numero_muestra: 2, nombre: 'Beto', registrado_en: null, formulario }],
      [{ numero_muestra: 2, datos: { pais: 'El Salvador', precio_finca: 4.5, premios: 'Taza de Excelencia' }, certificaciones: ['Rainforest Alliance'] }]
    );
    const campos = ficha.secciones.flatMap(s => s.campos);

    expect(campos.find(c => c.etiqueta === 'País')?.valor).toBe('El Salvador');
    expect(campos.find(c => c.etiqueta === 'Departamento')?.valor).toBe('Huila');
    expect(campos.find(c => c.etiqueta === 'Precio en finca')?.valor).toBe('$ 4,5 COP');
    expect(ficha.secciones.at(-1)?.titulo).toBe('Información adicional');
    expect(ficha.certificaciones).toContain('Rainforest Alliance');
  });

  it('keeps registry rows without a matching form and tolerates non-JSON notes', () => {
    const fichas = construirFichasTecnicas(
      [{ numero_muestra: 1, nombre: 'Ana', registrado_en: null, formulario: null }],
      [{ numero_muestra: 3, datos: { variedad: 'Geisha' }, certificaciones: null }]
    );

    expect(fichas.map(f => f.numeroMuestra)).toEqual([1, 3]);
    expect(fichas[0].secciones[0].campos.every(c => c.valor === '—')).toBe(true);
    expect(fichas[1].registradaPor).toBeNull();
  });
});

describe('textoDeCampo', () => {
  it('normalizes values for display', () => {
    expect(textoDeCampo(true)).toBe('Sí');
    expect(textoDeCampo(Number.NaN)).toBe('');
    expect(textoDeCampo(['x'])).toBe('');
  });
});
