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

  it('inserts a participant with database field names', async () => {
    from.mockReturnValue({ insert });
    insert.mockResolvedValue({ error: null });

    await service.insertarParticipanteDirecto('session-id', 'user-id', ' Ana ', true);

    expect(from).toHaveBeenCalledWith('participantes');
    const [participant] = insert.mock.calls[0][0];
    // El campo 'id' NUNCA debe estar presente en el insert (se deja al DEFAULT gen_random_uuid())
    expect(participant).not.toHaveProperty('id');
    expect(participant).toMatchObject({
      sesion_id: 'session-id',
      usuario_id: 'user-id',
      nombre: 'Ana',
      es_organizador: true,
      listo: true
    });
    expect(Number.isNaN(Date.parse(participant.unido_en))).toBe(false);
  });

  it('sanitizes empty usuarioId to null before inserting', async () => {
    from.mockReturnValue({ insert });
    insert.mockResolvedValue({ error: null });

    // Un string vacío '' en un campo uuid causa error 22P02 en PostgreSQL
    await service.insertarParticipanteDirecto('session-id', '', 'Invitado', false);
    const [participant] = insert.mock.calls[0][0];
    expect(participant.usuario_id).toBeNull();
  });

  it('rejects when sesionId is empty', async () => {
    await expect(
      service.insertarParticipanteDirecto('', 'user-id', 'Ana', true)
    ).rejects.toThrow('El ID de sesión es inválido');
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates participant insertion failures', async () => {
    const error = new Error('insert denied');
    from.mockReturnValue({ insert });
    insert.mockResolvedValue({ error });

    await expect(
      service.insertarParticipanteDirecto('session-id', 'user-id', 'Ana', true)
    ).rejects.toBe(error);
  });

  it('joins a session without sending an empty id and includes the current user and join time', async () => {
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
    getUser.mockResolvedValue({ data: { user: { id: 'taster-id' } }, error: null });

    const result = await service.unirseASesion(' AB12-3C4 ', ' Ana ');

    expect(result.participante.id).toBe('participant-id');
    expect(result.participante.usuarioId).toBe('taster-id');
    const [insertedParticipant] = participantInsert.mock.calls[0][0];
    // NUNCA se debe enviar 'id' en el insert
    expect(insertedParticipant).not.toHaveProperty('id');
    expect(insertedParticipant).toMatchObject({
      sesion_id: 'session-id',
      usuario_id: 'taster-id',
      nombre: 'Ana',
      es_organizador: false,
      listo: true
    });
    expect(Number.isNaN(Date.parse(insertedParticipant.unido_en))).toBe(false);
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
