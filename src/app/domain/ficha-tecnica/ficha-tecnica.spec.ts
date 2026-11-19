import { datoPreferente, esDatoVacio, precioPreferente, unirCertificaciones } from './ficha-tecnica';

describe('domain/ficha-tecnica', () => {
  it('considera vacíos los textos en blanco, NaN y objetos, pero no los booleanos', () => {
    expect(esDatoVacio('  ')).toBe(true);
    expect(esDatoVacio(Number.NaN)).toBe(true);
    expect(esDatoVacio({})).toBe(true);
    expect(esDatoVacio(false)).toBe(false);
    expect(esDatoVacio(0)).toBe(false);
  });

  it('la tabla gana y el formulario rellena el vacío', () => {
    expect(datoPreferente('El Salvador', 'Colombia')).toBe('El Salvador');
    expect(datoPreferente('', 'Colombia')).toBe('Colombia');
    expect(datoPreferente(null, '  ')).toBeUndefined();
  });

  it('el precio de la tabla gana solo si es número', () => {
    expect(precioPreferente(4.5, 3)).toBe(4.5);
    expect(precioPreferente('4.5', 3)).toBe(3);
    expect(precioPreferente(null, undefined)).toBeNull();
  });

  it('une certificaciones sin repetir y en orden', () => {
    expect(unirCertificaciones(['Rainforest Alliance'], { organic: true, rainforest: true }, 'Bird Friendly'))
      .toEqual(['Bird Friendly', 'Orgánico', 'Rainforest Alliance']);
  });
});
