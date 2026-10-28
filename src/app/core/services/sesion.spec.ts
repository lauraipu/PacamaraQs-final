import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EstadoSesion } from '../models/sesion.model';
import { SesionService } from './sesion';
import { SupabaseService } from './supabase';

describe('SesionService', () => {
  let service: SesionService;
  const insert = vi.fn();
  const select = vi.fn();
  const single = vi.fn();
  const from = vi.fn();
  const getUser = vi.fn();
  const participantInsert = vi.fn();
  const deleteQuery = vi.fn();
  const deleteFilter = vi.fn();
  const deleteSelect = vi.fn();
  const deleteMaybeSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        SesionService,
        { provide: SupabaseService, useValue: { client: { from, auth: { getUser } } } }
      ]
    });
    service = TestBed.inject(SesionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('inserts a session without a generated id and normalizes its format', async () => {
    const sessionDto = {
      id: 'generated-id',
      codigo_sesion: 'AB12-3C4',
      nombre: 'Cosecha',
      notas: '',
      formato_cva: 'combinado',
      numero_muestras: 6,
      catadores_objetivo: 5,
      organizador_id: 'user-id',
      organizador_participa: true,
      estado: 'esperando'
    };
    from.mockReturnValue({ insert, select, single });
    insert.mockReturnValue({ select });
    select.mockReturnValue({ single });
    single.mockResolvedValue({ data: sessionDto, error: null });

    const session = await service.crearSesion({
      id: '',
      codigoAcceso: '',
      nombre: 'Cosecha',
      formato: 'COMBINADO',
      numeroMuestras: 6,
      catadoresObjetivo: 5,
      organizadorId: 'user-id',
      organizadorParticipa: true,
      estado: EstadoSesion.EN_ESPERA
    });

    expect(from).toHaveBeenCalledWith('sesiones');
    const [insertedSession] = insert.mock.calls[0][0];
    expect(insertedSession).not.toHaveProperty('id');
    expect(insertedSession.formato_cva).toBe('combinado');
    expect(session.id).toBe('generated-id');
  });

  it('rejects a session with an empty name before calling Supabase', async () => {
    await expect(service.crearSesion({
      id: '',
      codigoAcceso: '',
      nombre: '  ',
      formato: 'combinado',
      numeroMuestras: 6,
      catadoresObjetivo: 5,
      organizadorId: 'user-id',
      organizadorParticipa: true,
      estado: EstadoSesion.EN_ESPERA
    })).rejects.toThrow('El nombre de la sesión no puede estar vacío');

    expect(from).not.toHaveBeenCalled();
  });

  it('deletes a session by ID and propagates Supabase errors', async () => {
    from.mockReturnValue({ delete: deleteQuery });
    deleteQuery.mockReturnValue({ eq: deleteFilter });
    deleteFilter.mockReturnValue({ select: deleteSelect });
    deleteSelect.mockReturnValue({ maybeSingle: deleteMaybeSingle });
    deleteMaybeSingle.mockResolvedValue({ data: { id: 'session-id' }, error: null });

    await service.eliminarSesion('session-id');

    expect(from).toHaveBeenCalledWith('sesiones');
    expect(deleteQuery).toHaveBeenCalledOnce();
    expect(deleteFilter).toHaveBeenCalledWith('id', 'session-id');
    expect(deleteSelect).toHaveBeenCalledWith('id');

    deleteMaybeSingle.mockResolvedValueOnce({ data: null, error: new Error('Delete denied') });
    await expect(service.eliminarSesion('session-id')).rejects.toThrow('Delete denied');

    deleteMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(service.eliminarSesion('session-id')).rejects.toThrow('Verifica que tengas permisos');
  });

  it('loads sessions where the user is a taster and merges their organizer sessions without duplicates', async () => {
    const sessionDto = {
      id: 'joined-session',
      codigo_sesion: 'AB12-3C4',
      nombre: 'Cosecha compartida',
      notas: '',
      formato_cva: 'afectivo',
      numero_muestras: 4,
      catadores_objetivo: 6,
      organizador_id: 'other-user',
      organizador_participa: true,
      estado: 'en_progreso',
      creado_en: '2026-10-23T00:00:00.000Z'
    };
    const participationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ sesion_id: 'joined-session', es_organizador: false }],
        error: null
      })
    };
    const ownedQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{
          ...sessionDto,
          id: 'owned-session',
          nombre: 'Mi sesión',
          organizador_id: 'user-id',
          formato_cva: 'combinado',
          estado: 'esperando',
          creado_en: '2026-10-24T00:00:00.000Z'
        }],
        error: null
      })
    };
    const participatingSessionsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [sessionDto], error: null })
    };
    from.mockImplementation((table: string) => {
      if (table === 'participantes') return participationQuery;
      return ownedQuery.order.mock.calls.length === 0 ? ownedQuery : participatingSessionsQuery;
    });

    const sessions = await service.obtenerMisSesiones('user-id');

    expect(from).toHaveBeenNthCalledWith(1, 'participantes');
    expect(participationQuery.select).toHaveBeenCalledWith('sesion_id, es_organizador');
    expect(participationQuery.eq).toHaveBeenCalledWith('usuario_id', 'user-id');
    expect(participatingSessionsQuery.in).toHaveBeenCalledWith('id', ['joined-session']);
    expect(sessions).toHaveLength(2);
    expect(sessions.find(session => session.id === 'joined-session')).toMatchObject({
      nombre: 'Cosecha compartida',
      esOrganizador: false
    });
    expect(sessions.find(session => session.id === 'owned-session')?.esOrganizador).toBe(true);
  });

  it('inserts a participant with database field names', async () => {
    const participantDto = {
      id: 'participant-id',
      sesion_id: 'session-id',
      usuario_id: 'user-id',
      nombre: 'Ana',
      es_organizador: true,
      listo: false,
      unido_en: new Date().toISOString()
    };
    const existingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    existingQuery.select.mockReturnValue(existingQuery);
    existingQuery.eq.mockReturnValue(existingQuery);
    const participantSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: participantDto, error: null })
    });
    from.mockImplementation((table: string) =>
      table === 'participantes'
        ? { select: existingQuery.select, eq: existingQuery.eq, maybeSingle: existingQuery.maybeSingle, insert }
        : undefined
    );
    insert.mockReturnValue({ select: participantSelect });

    const savedParticipant = await service.insertarParticipanteDirecto('session-id', 'user-id', ' Ana ', true);

    expect(from).toHaveBeenCalledWith('participantes');
    expect(savedParticipant.id).toBe('participant-id');
    const [participantToInsert] = insert.mock.calls[0][0];
    // El campo 'id' NUNCA debe estar presente en el insert (se deja al DEFAULT gen_random_uuid())
    expect(participantToInsert).not.toHaveProperty('id');
    expect(participantToInsert).toMatchObject({
      sesion_id: 'session-id',
      usuario_id: 'user-id',
      nombre: 'Ana',
      es_organizador: true,
      listo: false
    });
    expect(Number.isNaN(Date.parse(participantToInsert.unido_en))).toBe(false);
  });

  it('sanitizes empty usuarioId to null before inserting', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const participantSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'participant-id',
          sesion_id: 'session-id',
          usuario_id: null,
          nombre: 'Invitado',
          es_organizador: false,
          listo: false,
          unido_en: new Date().toISOString()
        },
        error: null
      })
    });
    from.mockReturnValue({ insert });
    insert.mockReturnValue({ select: participantSelect });

    // Un string vacío '' en un campo uuid causa error 22P02 en PostgreSQL
    await service.insertarParticipanteDirecto('session-id', '', 'Invitado', false);
    const [participantToInsert] = insert.mock.calls[0][0];
    expect(participantToInsert.usuario_id).toBeNull();
  });

  it('rejects when sesionId is empty', async () => {
    await expect(
      service.insertarParticipanteDirecto('', 'user-id', 'Ana', true)
    ).rejects.toThrow('El ID de sesión es inválido');
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates participant insertion failures', async () => {
    const error = new Error('insert denied');
    const existingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    existingQuery.select.mockReturnValue(existingQuery);
    existingQuery.eq.mockReturnValue(existingQuery);
    const participantSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: null, error })
    });
    from.mockImplementation(() => ({
      select: existingQuery.select,
      eq: existingQuery.eq,
      maybeSingle: existingQuery.maybeSingle,
      insert
    }));
    insert.mockReturnValue({ select: participantSelect });

    await expect(
      service.insertarParticipanteDirecto('session-id', 'user-id', 'Ana', true)
    ).rejects.toBe(error);
  });

  it('returns an existing participant without inserting a duplicate', async () => {
    const existingParticipant = {
      id: 'existing-id',
      sesion_id: 'session-id',
      usuario_id: 'user-id',
      nombre: 'Ana',
      es_organizador: true,
      listo: false,
      unido_en: '2026-10-21T00:00:00.000Z'
    };
    const existingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: existingParticipant, error: null })
    };
    existingQuery.select.mockReturnValue(existingQuery);
    existingQuery.eq.mockReturnValue(existingQuery);
    from.mockReturnValue(existingQuery);

    const result = await service.insertarParticipanteDirecto('session-id', 'user-id', 'Ana', true);

    expect(result.id).toBe('existing-id');
    expect(insert).not.toHaveBeenCalled();
  });

  it('joins as an anonymous user directly in participants using the Auth UUID', async () => {
    const sessionDto = {
      id: 'session-id',
      codigo_sesion: 'AB12-3C4',
      nombre: 'Cosecha',
      formato_cva: 'combinado',
      numero_muestras: 6,
      catadores_objetivo: 5,
      organizador_id: 'organizer-id',
      organizador_participa: true,
      estado: 'esperando'
    };
    const participantDto = {
      id: 'participant-id',
      sesion_id: 'session-id',
      usuario_id: 'taster-id',
      nombre: 'Ana',
      es_organizador: false,
      listo: true,
      unido_en: '2026-10-21T00:00:00.000Z'
    };

    // sesiones: SELECT por codigo_sesion
    const sesionesEq = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: sessionDto, error: null })
    });
    const sesionesSelect = vi.fn().mockReturnValue({ eq: sesionesEq });

    // participantes: (1) SELECT idempotencia → null, (2) INSERT
    let participantesCallCount = 0;
    const maybeSingleCheck = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle: maybeSingleCheck });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const participantesCheckSelect = vi.fn().mockReturnValue({ eq: eq1 });
    const participantInsertSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: participantDto, error: null })
    });

    from.mockImplementation((table: string) => {
      if (table === 'sesiones') return { select: sesionesSelect };
      // Primera llamada a participantes: verificación de existencia
      if (participantesCallCount === 0) {
        participantesCallCount++;
        return { select: participantesCheckSelect };
      }
      // Segunda llamada a participantes: insert
      return { insert: participantInsert.mockReturnValue({ select: participantInsertSelect }) };
    });
    participantInsert.mockClear();
    getUser.mockResolvedValue({
      data: { user: { id: 'taster-id', is_anonymous: true } },
      error: null
    });

    const result = await service.unirseASesion(' AB12-3C4 ', '');

    expect(result.participante.id).toBe('participant-id');
    expect(result.participante.usuarioId).toBe('taster-id');
    expect(from.mock.calls.map(([table]) => table)).toEqual(['sesiones', 'participantes', 'participantes']);
    const [insertedParticipant] = participantInsert.mock.calls[0][0];
    // NUNCA se debe enviar 'id' en el insert
    expect(insertedParticipant).not.toHaveProperty('id');
    expect(insertedParticipant).toMatchObject({
      sesion_id: 'session-id',
      usuario_id: 'taster-id',
      nombre: 'Catador Invitado',
      es_organizador: false,
      listo: true
    });
    expect(Number.isNaN(Date.parse(insertedParticipant.unido_en))).toBe(false);
  });

  it('does not insert a participant without an authenticated user', async () => {
    const sessionDto = {
      id: 'session-id',
      codigo_sesion: 'AB12-3C4',
      nombre: 'Cosecha',
      formato_cva: 'combinado',
      numero_muestras: 6,
      catadores_objetivo: 5,
      organizador_id: 'organizer-id',
      organizador_participa: true,
      estado: 'esperando'
    };
    const sesionesEq = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: sessionDto, error: null })
    });
    const sesionesSelect = vi.fn().mockReturnValue({ eq: sesionesEq });
    from.mockImplementation((table: string) => {
      if (table === 'sesiones') return { select: sesionesSelect };
      return { insert: participantInsert };
    });
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(service.unirseASesion('AB12-3C4', 'Catador'))
      .rejects.toThrow('No hay sesión de autenticación activa');

    expect(participantInsert).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('returns existing participant without inserting when already joined (idempotency)', async () => {
    const sessionDto = {
      id: 'session-id',
      codigo_sesion: 'AB12-3C4',
      nombre: 'Cosecha',
      formato_cva: 'combinado',
      numero_muestras: 6,
      catadores_objetivo: 5,
      organizador_id: 'organizer-id',
      organizador_participa: true,
      estado: 'esperando'
    };
    const existingParticipant = {
      id: 'existing-id',
      sesion_id: 'session-id',
      usuario_id: 'taster-id',
      nombre: 'Ana',
      es_organizador: false,
      listo: true,
      unido_en: '2026-10-21T00:00:00.000Z'
    };

    const sesionesEq = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: sessionDto, error: null })
    });
    const sesionesSelect = vi.fn().mockReturnValue({ eq: sesionesEq });

    // participantes: SELECT idempotencia → devuelve participante existente
    const maybeSingleCheck = vi.fn().mockResolvedValue({ data: existingParticipant, error: null });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle: maybeSingleCheck });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const participantesCheckSelect = vi.fn().mockReturnValue({ eq: eq1 });

    from.mockImplementation((table: string) => {
      if (table === 'sesiones') return { select: sesionesSelect };
      return { select: participantesCheckSelect };
    });
    participantInsert.mockClear();
    getUser.mockResolvedValue({ data: { user: { id: 'taster-id' } }, error: null });

    const result = await service.unirseASesion('AB12-3C4', 'Ana');

    // No se debe haber ejecutado un INSERT
    expect(participantInsert).not.toHaveBeenCalled();
    expect(result.participante.id).toBe('existing-id');
  });
});
