import { EstadoSesion } from '../models/sesion.model';
import { participanteDtoToDomain, sesionDtoToDomain } from './sesion.mapper';

describe('sesion mapper', () => {
  it('maps the in-progress database state to the initiated session state', () => {
    const session = sesionDtoToDomain({
      id: 'session-id',
      nombre: 'Cata',
      formato_cva: 'afectivo',
      numero_muestras: 3,
      catadores_objetivo: 5,
      organizador_participa: false,
      codigo_sesion: 'AB12-3C4',
      organizador_id: 'organizer-id',
      estado: 'en_progreso'
    });

    expect(session.estado).toBe(EstadoSesion.INICIADA);
    expect(EstadoSesion.INICIADA).toBe('en_progreso');
  });

  it('maps session state and nullable database fields to the domain model', () => {
    const session = sesionDtoToDomain({
      id: 'session-id',
      nombre: 'Cata',
      formato_cva: 'afectivo',
      numero_muestras: 3,
      catadores_objetivo: 5,
      organizador_participa: false,
      codigo_sesion: 'AB12-3C4',
      organizador_id: 'organizer-id',
      estado: 'cancelada',
      notas: null,
      creado_en: null
    });

    expect(session).toEqual({
      id: 'session-id',
      codigoAcceso: 'AB12-3C4',
      nombre: 'Cata',
      notas: '',
      formato: 'afectivo',
      numeroMuestras: 3,
      catadoresObjetivo: 5,
      organizadorId: 'organizer-id',
      organizadorParticipa: false,
      estado: EstadoSesion.CANCELADA,
      creadaEn: undefined
    });
  });

  it('preserves false participant values and maps missing user ids to empty strings', () => {
    const participant = participanteDtoToDomain({
      sesion_id: 'session-id',
      usuario_id: null,
      nombre: 'Catador',
      es_organizador: false,
      listo: false
    });

    expect(participant).toMatchObject({
      sesionId: 'session-id',
      usuarioId: '',
      esOrganizador: false,
      listo: false
    });
  });
});
