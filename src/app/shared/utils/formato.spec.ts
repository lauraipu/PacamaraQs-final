import { iniciales, localeDe, megabytes } from './formato';
import { RespaldoPipe } from '../pipes/respaldo.pipe';

describe('shared/utils/formato', () => {
  it('convierte bytes a megabytes con un decimal', () => {
    expect(megabytes(14 * 1024 * 1024)).toBe('14.0');
    expect(megabytes(0)).toBe('0.0');
  });

  it('toma las iniciales de hasta dos palabras', () => {
    expect(iniciales('laura sofía ipuz')).toBe('LS');
    expect(iniciales('   ')).toBe('?');
  });

  it('usa es-CO cuando el idioma no es conocido', () => {
    expect(localeDe('it')).toBe('it-IT');
    expect(localeDe('fr')).toBe('es-CO');
  });

  it('el pipe respaldo usa la alternativa solo si falta el dato', () => {
    const pipe = new RespaldoPipe();
    expect(pipe.transform('Ana', 'x')).toBe('Ana');
    expect(pipe.transform('  ', 'correo@x.co')).toBe('correo@x.co');
    expect(pipe.transform(null)).toBe('—');
  });
});
