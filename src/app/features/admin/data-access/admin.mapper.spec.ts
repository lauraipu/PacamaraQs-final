import { aConfiguracion, aEvento, aPagina, aResumen, aSesion, aUsuario } from './admin.mapper';

describe('admin.mapper', () => {
  it('convierte la configuración del laboratorio y sus medidores', () => {
    const r = aConfiguracion({
      configuracion: {
        pausada: false, pausar_desde: '2026-11-26T12:00:00Z', mensaje_pausa: 'En pausa',
        registros_abiertos: false, max_sesiones_abiertas: 5, max_escaneos_hora: 0, limite_bd_mb: 400,
        actualizado_en: null, actualizado_por: null
      },
      uso: { en_pausa: false, tamano_bd_bytes: 2048, sesiones_abiertas: 2, escaneos_24h: 3, usuarios: 7, evaluaciones: 9 }
    });
    expect(r.configuracion.pausarDesde?.toISOString()).toBe('2026-11-26T12:00:00.000Z');
    expect(r.configuracion.registrosAbiertos).toBe(false);
    expect(r.configuracion.maxEscaneosHora).toBe(0);
    expect(r.actualizadoEn).toBeNull();
    expect(r.uso).toEqual({ enPausa: false, tamanoBdBytes: 2048, sesionesAbiertas: 2, escaneos24h: 3, usuarios: 7, evaluaciones: 9 });
  });

  it('convierte el resumen y completa los estados que faltan con 0', () => {
    const r = aResumen({
      usuarios: 5, administradores: 1, usuarios_nuevos_7d: 2, activos_7d: 3, sesiones: 4,
      sesiones_por_estado: { completada: 3 }, sesiones_por_formato: { combinado: 4 },
      evaluaciones: 10, evaluaciones_7d: 6, escaneos_24h: 0, escaneos_7d: 1,
      tamano_bd_bytes: 1024, actividad_14d: [{ dia: '2026-11-19', sesiones: 1, evaluaciones: 2 }]
    });
    expect(r.sesionesPorEstado).toEqual({ esperando: 0, en_progreso: 0, completada: 3, cancelada: 0 });
    expect(r.sesionesPorFormato.afectivo).toBe(0);
    expect(r.actividad14d[0].dia.getDate()).toBe(19);
  });

  it('deja el nombre en null cuando falta (la vista decide el respaldo) y normaliza el rol', () => {
    const u = aUsuario({
      id: '1', email: 'a@b.co', nombre: null, rol_global: 'otro', creado_en: '2026-11-01T00:00:00Z',
      idioma: 'es', activo: true, desactivado_en: null, ultimo_acceso: null, tiene_dos_pasos: true, sesiones_organizadas: 2, evaluaciones: 3
    });
    expect(u.nombre).toBeNull();
    expect(u.rol).toBe('catador');
    expect(u.ultimoAcceso).toBeNull();
  });

  it('mapea páginas vacías sin fallar', () => {
    expect(aPagina(null, aSesion)).toEqual({ total: 0, filas: [] });
  });

  it('deja el actor en null cuando el evento no tiene actor', () => {
    const e = aEvento({
      id: 1, tabla: 'sesiones', operacion: 'DELETE', registro_id: 'x', sesion_id: null,
      sesion_nombre: null, actor_nombre: null, actor_email: null, datos: null, creado_en: '2026-11-01T00:00:00Z'
    });
    expect(e.actor).toBeNull();
    expect(e.datos).toEqual({});
  });
});
