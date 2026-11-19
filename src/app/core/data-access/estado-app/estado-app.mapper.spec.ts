import { aEstadoApp } from './estado-app.mapper';

describe('aEstadoApp', () => {
  const ahora = new Date('2026-11-19T12:00:00Z');

  it('devuelve null sin datos', () => {
    expect(aEstadoApp(null, ahora)).toBeNull();
  });

  it('marca la pausa activa y no muestra pausa programada', () => {
    const e = aEstadoApp({ en_pausa: true, mensaje: ' En pausa ', pausar_desde: '2026-11-18T00:00:00Z', registros_abiertos: true }, ahora);
    expect(e).toEqual({ enPausa: true, mensaje: 'En pausa', pausaProgramada: null, registrosAbiertos: true });
  });

  it('solo informa la pausa programada si es futura', () => {
    const futura = aEstadoApp({ en_pausa: false, mensaje: 'x', pausar_desde: '2026-11-26T12:00:00Z', registros_abiertos: false }, ahora);
    expect(futura?.pausaProgramada?.toISOString()).toBe('2026-11-26T12:00:00.000Z');
    expect(futura?.registrosAbiertos).toBe(false);
    const pasada = aEstadoApp({ en_pausa: false, mensaje: 'x', pausar_desde: '2026-11-01T00:00:00Z', registros_abiertos: true }, ahora);
    expect(pasada?.pausaProgramada).toBeNull();
  });
});
