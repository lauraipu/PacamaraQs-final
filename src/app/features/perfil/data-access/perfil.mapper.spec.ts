import { aPerfil } from './perfil.mapper';

describe('perfil.mapper', () => {
  it('traduce la fila y deja preferencias vacías cuando vienen en null', () => {
    expect(aPerfil({ nombre: 'Ana', idioma: 'es', preferencias: null }))
      .toEqual({ nombre: 'Ana', idioma: 'es', preferencias: {} });
  });

  it('conserva las preferencias de accesibilidad', () => {
    const p = aPerfil({ nombre: null, idioma: null, preferencias: { altoContraste: true, tamanoTexto: 120 } });
    expect(p.preferencias.altoContraste).toBe(true);
    expect(p.preferencias.tamanoTexto).toBe(120);
  });
});
