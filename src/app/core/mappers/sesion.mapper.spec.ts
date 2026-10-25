import { EstadoSesion, Sesion } from '../models/sesion.model';
import {
  participanteDtoToDomain,
  participanteToDto,
  sesionDtoToDomain,
  sesionToDto
} from './sesion.mapper';

describe('sesion mapper', () => {
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

  it('round-trips cancelled sessions without treating them as completed', () => {
    const session: Sesion = {
      id: '',
      codigoAcceso: 'AB12-3C4',
      nombre: 'Cata',
      formato: 'afectivo',
      numeroMuestras: 3,
      catadoresObjetivo: 5,
      organizadorId: 'organizer-id',
      organizadorParticipa: true,
      estado: EstadoSesion.CANCELADA
    };

    expect(sesionToDto(session)).toMatchObject({
      id: null,
      estado: 'cancelada'
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

    const dto = participanteToDto(participant);
    expect(dto.usuario_id).toBeNull();
  });
});
