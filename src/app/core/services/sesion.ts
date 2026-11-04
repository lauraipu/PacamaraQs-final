import { inject, Injectable } from '@angular/core';
import { participanteDtoToDomain, sesionDtoToDomain } from '../mappers/sesion.mapper';
import { Participante, ParticipanteDto, Sesion, SesionDto } from '../models/sesion.model';
import { SupabaseService } from './supabase';

export interface SesionConRol extends Sesion {
  esOrganizador: boolean;
}

/** Progreso del panel SIN puntajes (evaluación ciega). */
export interface ProgresoCatador {
  usuarioId: string;
  nombre: string;
  esOrganizador: boolean;
  listo: boolean;
  muestrasEnviadas: number[];
}

export interface ProgresoPanel {
  estado: string;
  numeroMuestras: number;
  muestrasCerradas: number[];
  catadores: ProgresoCatador[];
}

export interface ResultadoCierreMuestra {
  numeroMuestra: number;
  fichasPendientesDescartadas: number;
  sesionCompletada: boolean;
}

interface ProgresoPanelDto {
  estado: string;
  numero_muestras: number;
  muestras_cerradas: number[] | null;
  catadores: {
    usuario_id: string;
    nombre: string;
    es_organizador: boolean;
    listo: boolean;
    muestras_enviadas: number[] | null;
  }[] | null;
}

interface CierreMuestraDto {
  numero_muestra: number;
  fichas_pendientes_descartadas: number;
  sesion_completada: boolean;
}

/**
 * Acceso a datos de sesiones. Todas las escrituras de estado pasan por RPCs
 * SECURITY DEFINER que validan las reglas de negocio en el servidor; el
 * cliente nunca escribe directo en sesiones/participantes/muestras.
 * El tiempo real (Presence/Broadcast) vive en RealtimeService.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly supabase = inject(SupabaseService);

  async crearSesion(sesion: Sesion): Promise<Sesion> {
    if (!sesion.nombre?.trim()) {
      throw new Error('El nombre de la sesión no puede estar vacío');
    }

    const { data, error } = await this.supabase.client.rpc('crear_sesion', {
      p_nombre: sesion.nombre.trim(),
      p_formato: sesion.formato.toLowerCase(),
      p_numero_muestras: sesion.numeroMuestras,
      p_catadores_objetivo: sesion.catadoresObjetivo,
      p_organizador_participa: sesion.organizadorParticipa,
      p_notas: sesion.notas?.trim() || null
    });

    if (error) throw error;
    if (!data) throw new Error('Supabase no devolvió la sesión creada.');
    return sesionDtoToDomain(data as SesionDto);
  }

  async obtenerSesionPorId(sesionId: string): Promise<Sesion | null> {
    const { data, error } = await this.supabase.client
      .from('sesiones')
      .select('*')
      .eq('id', sesionId)
      .maybeSingle();

    if (error) throw error;
    return data ? sesionDtoToDomain(data as SesionDto) : null;
  }

  async esOrganizadorDeSesion(sesionId: string, usuarioId: string): Promise<boolean> {
    const { data, error } = await this.supabase.client
      .from('sesiones')
      .select('organizador_id')
      .eq('id', sesionId)
      .maybeSingle();

    if (error) throw error;
    return data?.organizador_id === usuarioId;
  }

  async obtenerMisSesiones(usuarioId: string): Promise<SesionConRol[]> {
    if (!usuarioId.trim()) throw new Error('El ID de usuario es inválido');

    const { data: participaciones, error: errorParticipaciones } = await this.supabase.client
      .from('participantes')
      .select('sesion_id, es_organizador')
      .eq('usuario_id', usuarioId);
    if (errorParticipaciones) throw errorParticipaciones;

    const rolesPorSesion = new Map<string, boolean>();
    for (const participacion of participaciones ?? []) {
      if (!participacion.sesion_id) continue;
      rolesPorSesion.set(
        participacion.sesion_id,
        (rolesPorSesion.get(participacion.sesion_id) ?? false) || participacion.es_organizador === true
      );
    }

    const idsParticipacion = [...rolesPorSesion.keys()];
    const [organizadas, participadas] = await Promise.all([
      this.supabase.client
        .from('sesiones')
        .select('*')
        .eq('organizador_id', usuarioId)
        .order('creado_en', { ascending: false }),
      idsParticipacion.length > 0
        ? this.supabase.client.from('sesiones').select('*').in('id', idsParticipacion)
        : Promise.resolve({ data: [] as SesionDto[], error: null })
    ]);

    if (organizadas.error) throw organizadas.error;
    if (participadas.error) throw participadas.error;

    const sesiones = new Map<string, SesionConRol>();
    for (const dto of (organizadas.data ?? []) as SesionDto[]) {
      const sesion = sesionDtoToDomain(dto);
      if (sesion.id) sesiones.set(sesion.id, { ...sesion, esOrganizador: true });
    }
    for (const dto of (participadas.data ?? []) as SesionDto[]) {
      const sesion = sesionDtoToDomain(dto);
      if (!sesion.id) continue;
      const existente = sesiones.get(sesion.id);
      sesiones.set(sesion.id, {
        ...sesion,
        esOrganizador: existente?.esOrganizador ?? rolesPorSesion.get(sesion.id) ?? false
      });
    }

    return [...sesiones.values()].sort((a, b) => (b.creadaEn ?? '').localeCompare(a.creadaEn ?? ''));
  }

  async eliminarSesion(sesionId: string): Promise<void> {
    if (!sesionId.trim()) throw new Error('El ID de sesión es inválido');

    const { data, error } = await this.supabase.client
      .from('sesiones')
      .delete()
      .eq('id', sesionId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('No se eliminó la sesión. Verifica que tengas permisos para eliminarla.');
  }

  async unirseASesion(codigo: string): Promise<{ sesion: Sesion }> {
    const codigoNormalizado = codigo.trim().toUpperCase();
    if (!codigoNormalizado) throw new Error('El código es obligatorio');

    const { data: sesionId, error } = await this.supabase.client.rpc('unirse_sesion', {
      p_codigo: codigoNormalizado
    });
    if (error) throw error;
    if (typeof sesionId !== 'string' || !sesionId) throw new Error('No se pudo unir a la sesión.');

    const sesion = await this.obtenerSesionPorId(sesionId);
    if (!sesion?.id) {
      throw new Error('Te uniste, pero no se pudo cargar la sesión. Intenta actualizar el panel.');
    }
    return { sesion };
  }

  /** Lista autoritativa de participantes (resincronización REST). */
  async obtenerParticipantes(sesionId: string): Promise<Participante[]> {
    const { data, error } = await this.supabase.client
      .from('participantes')
      .select('*')
      .eq('sesion_id', sesionId)
      .order('unido_en', { ascending: true });

    if (error) throw error;
    return this.normalizarParticipantes((data ?? []) as ParticipanteDto[]);
  }

  async obtenerMuestrasCerradas(sesionId: string): Promise<number[]> {
    const { data, error } = await this.supabase.client
      .from('cierres_muestra')
      .select('numero_muestra')
      .eq('sesion_id', sesionId);

    if (error) throw error;
    return (data ?? [])
      .map(fila => Number(fila.numero_muestra))
      .filter(numero => Number.isInteger(numero))
      .sort((a, b) => a - b);
  }

  async marcarComoListo(sesionId: string, listo = true): Promise<void> {
    const { error } = await this.supabase.client.rpc('marcar_listo', {
      p_sesion_id: sesionId,
      p_listo: listo
    });
    if (error) throw error;
  }

  /**
   * Sin `usuarioId`: el usuario actual abandona la sesión.
   * Con `usuarioId`: el organizador retira a un catador (Grace Period vencido).
   */
  async abandonarSesion(sesionId: string, usuarioId?: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('abandonar_sesion', {
      p_sesion_id: sesionId,
      p_usuario_id: usuarioId ?? null
    });
    if (error) throw error;
  }

  async iniciarSesion(sesionId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('iniciar_sesion', { p_sesion_id: sesionId });
    if (error) throw error;
  }

  async forzarCierreMuestra(sesionId: string, numeroMuestra: number, motivo?: string): Promise<ResultadoCierreMuestra> {
    const { data, error } = await this.supabase.client.rpc('forzar_cierre_muestra', {
      p_sesion_id: sesionId,
      p_numero_muestra: numeroMuestra,
      p_motivo: motivo?.trim() || null
    });
    if (error) throw error;

    const dto = data as CierreMuestraDto | null;
    return {
      numeroMuestra: Number(dto?.numero_muestra ?? numeroMuestra),
      fichasPendientesDescartadas: Number(dto?.fichas_pendientes_descartadas ?? 0),
      sesionCompletada: dto?.sesion_completada === true
    };
  }

  async finalizarSesionForzado(sesionId: string, motivo?: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('finalizar_sesion_forzado', {
      p_sesion_id: sesionId,
      p_motivo: motivo?.trim() || null
    });
    if (error) throw error;
  }

  async obtenerProgresoPanel(sesionId: string): Promise<ProgresoPanel> {
    const { data, error } = await this.supabase.client.rpc('get_progreso_panel', { p_sesion_id: sesionId });
    if (error) throw error;

    const dto = data as ProgresoPanelDto | null;
    return {
      estado: dto?.estado ?? '',
      numeroMuestras: Number(dto?.numero_muestras ?? 0),
      muestrasCerradas: (dto?.muestras_cerradas ?? []).map(Number),
      catadores: (dto?.catadores ?? []).map(c => ({
        usuarioId: c.usuario_id,
        nombre: c.nombre,
        esOrganizador: c.es_organizador === true,
        listo: c.listo === true,
        muestrasEnviadas: (c.muestras_enviadas ?? []).map(Number)
      }))
    };
  }

  /** Descarta filas sin usuario real y deduplica por usuario (defensa en profundidad). */
  private normalizarParticipantes(filas: ParticipanteDto[]): Participante[] {
    const porUsuario = new Map<string, Participante>();
    for (const fila of filas) {
      const participante = participanteDtoToDomain(fila);
      if (participante.usuarioId && !porUsuario.has(participante.usuarioId)) {
        porUsuario.set(participante.usuarioId, participante);
      }
    }
    return [...porUsuario.values()];
  }
}
