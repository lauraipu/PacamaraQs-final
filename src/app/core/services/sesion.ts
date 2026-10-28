import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { participanteDtoToDomain, participanteToDto, sesionDtoToDomain, sesionToDto } from '../mappers/sesion.mapper';
import { EstadoSesion, Participante, Sesion, SesionDto } from '../models/sesion.model';
import { SupabaseService } from './supabase';

export interface SesionConRol extends Sesion {
  esOrganizador: boolean;
}

@Injectable({ providedIn: 'root' })
export class SesionService {
  public readonly supabase = inject(SupabaseService);

  async crearSesion(sesion: Sesion): Promise<Sesion> {
    if (!sesion.nombre || sesion.nombre.trim() === '') {
      throw new Error('El nombre de la sesión no puede estar vacío');
    }

    const sesionNormalizada: Sesion = {
      ...sesion,
      formato: sesion.formato.toLowerCase(),
      codigoAcceso: this.generarCodigoUnico()
    };
    const dto = sesionToDto(sesionNormalizada);
    delete dto.id;

    const { data, error } = await this.supabase.client
      .from('sesiones')
      .insert([dto])
      .select()
      .single();

    if (error) throw error;
    return sesionDtoToDomain(data);
  }

  async insertarParticipanteDirecto(
    sesionId: string,
    usuarioId?: string | null,
    nombre?: string,
    esOrganizador = true,
    listo = false
  ): Promise<Participante> {
    return this.insertarParticipanteSeguro({ sesionId, usuarioId, nombre, esOrganizador, listo });
  }

  async obtenerSesionPorCodigo(codigo: string): Promise<Sesion | null> {
    const { data, error } = await this.supabase.client
      .from('sesiones')
      .select('*')
      .eq('codigo_sesion', codigo.trim().toUpperCase())
      .maybeSingle();

    if (error) throw error;
    return data ? sesionDtoToDomain(data) : null;
  }

  async obtenerSesionPorId(sesionId: string): Promise<Sesion | null> {
    const { data, error } = await this.supabase.client
      .from('sesiones')
      .select('*')
      .eq('id', sesionId)
      .maybeSingle();

    if (error) throw error;
    return data ? sesionDtoToDomain(data) : null;
  }

  async obtenerMisSesiones(usuarioId: string): Promise<SesionConRol[]> {
    if (!usuarioId.trim()) {
      throw new Error('El ID de usuario es inválido');
    }

    const { data: participaciones, error: errorParticipaciones } = await this.supabase.client
      .from('participantes')
      .select('sesion_id, es_organizador')
      .eq('usuario_id', usuarioId);
    if (errorParticipaciones) throw errorParticipaciones;

    const rolesPorSesion = new Map<string, boolean>();
    for (const participacion of participaciones) {
      if (!participacion.sesion_id) continue;
      rolesPorSesion.set(
        participacion.sesion_id,
        (rolesPorSesion.get(participacion.sesion_id) ?? false) || participacion.es_organizador === true
      );
    }

    const idsParticipacion = [...rolesPorSesion.keys()];
    const [sesionesOrganizadas, sesionesParticipadas] = await Promise.all([
      this.supabase.client
        .from('sesiones')
        .select('*')
        .eq('organizador_id', usuarioId)
        .order('creado_en', { ascending: false }),
      idsParticipacion.length > 0
        ? this.supabase.client
          .from('sesiones')
          .select('*')
          .in('id', idsParticipacion)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (sesionesOrganizadas.error) throw sesionesOrganizadas.error;
    if (sesionesParticipadas.error) throw sesionesParticipadas.error;

    const sesiones = new Map<string, SesionConRol>();
    for (const dto of sesionesOrganizadas.data) {
      const sesion = sesionDtoToDomain(dto);
      if (sesion.id) sesiones.set(sesion.id, { ...sesion, esOrganizador: true });
    }

    for (const dto of sesionesParticipadas.data) {
      const sesion = sesionDtoToDomain(dto);
      if (!sesion.id) continue;

      const sesionExistente = sesiones.get(sesion.id);
      sesiones.set(sesion.id, {
        ...sesion,
        esOrganizador: sesionExistente?.esOrganizador ?? rolesPorSesion.get(sesion.id) ?? false
      });
    }

    return [...sesiones.values()].sort((a, b) =>
      (b.creadaEn ?? '').localeCompare(a.creadaEn ?? '')
    );
  }

  async eliminarSesion(sesionId: string): Promise<void> {
    if (!sesionId.trim()) {
      throw new Error('El ID de sesión es inválido');
    }

    const { data, error } = await this.supabase.client
      .from('sesiones')
      .delete()
      .eq('id', sesionId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('No se eliminó la sesión. Verifica que tengas permisos para eliminarla.');
  }

  async unirseASesion(
    codigo: string,
    nombreCatador: string
  ): Promise<{ sesion: Sesion; participante: Participante }> {
    const codigoNormalizado = codigo.trim().toUpperCase();
    const nombre = nombreCatador.trim() || 'Catador Invitado';
    if (!codigoNormalizado) {
      throw new Error('El código es obligatorio');
    }

    const sesion = await this.obtenerSesionPorCodigo(codigoNormalizado);
    if (!sesion || !sesion.id) {
      throw new Error('No se encontró ninguna sesión con ese código');
    }
    if (sesion.estado !== EstadoSesion.EN_ESPERA) {
      throw new Error('La sesión ya ha iniciado o finalizado');
    }

    const { data: { user }, error: userError } = await this.supabase.client.auth.getUser();
    if (userError) throw userError;
    if (!user?.id?.trim()) {
      throw new Error('No hay sesión de autenticación activa');
    }

    const participante = await this.insertarParticipanteSeguro({
      sesionId: sesion.id,
      usuarioId: user.id,
      nombre,
      esOrganizador: false,
      listo: true
    });
    return { sesion, participante };
  }

  async marcarComoListo(participanteId: string, listo = true): Promise<void> {
    const { error } = await this.supabase.client
      .from('participantes')
      .update({ listo })
      .eq('id', participanteId);

    if (error) throw error;
  }

  async iniciarSesion(sesionId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('sesiones')
      .update({ estado: 'en_progreso' })
      .eq('id', sesionId);

    if (error) throw error;
  }

  observarParticipantes(sesionId: string): Observable<Participante[]> {
    return new Observable<Participante[]>(observer => {
      const idLimpio = sesionId?.trim();
      if (!idLimpio) {
        observer.error(new Error('ID de sesión inválido'));
        return;
      }

      let activo = true;

      const cargarParticipantes = async () => {
        try {
          const { data, error } = await this.supabase.client
            .from('participantes')
            .select('*')
            .eq('sesion_id', idLimpio);

          if (error) {
            console.error('Error al consultar participantes en Supabase:', error);
            if (activo) observer.error(error);
            return;
          }

          if (activo && data) {
            observer.next(data.map(participanteDtoToDomain));
          }
        } catch (err) {
          console.error('Error inesperado al cargar participantes:', err);
          if (activo) observer.error(err);
        }
      };

      // 1. Carga inicial inmediata por REST
      void cargarParticipantes();

      // 2. Sondeo de respaldo periódico (mitiga problemas si el canal Realtime falla con 'transport failure')
      const intervalId = setInterval(() => {
        if (activo) {
          void cargarParticipantes();
        }
      }, 4000);

      // 3. Canal Realtime con identificador único para evitar colisiones con suscripciones previas
      const channelName = `sala_espera_${idLimpio}_${Date.now()}`;
      const channel = this.supabase.client
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'participantes', filter: `sesion_id=eq.${idLimpio}` },
          () => {
            void cargarParticipantes();
          }
        )
        .subscribe((status, error) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Realtime Supabase] Aviso en el canal (${status}):`, error);
            // Reintentar vía REST sin romper el Observable
            void cargarParticipantes();
          }
        });

      return () => {
        activo = false;
        clearInterval(intervalId);
        void this.supabase.client.removeChannel(channel);
      };
    });
  }

  observarSesion(sesionId: string): Observable<Sesion> {
    return new Observable<Sesion>(observer => {
      const idLimpio = sesionId?.trim();
      if (!idLimpio) {
        observer.error(new Error('ID de sesión inválido'));
        return;
      }

      let activo = true;
      const cargarSesion = async () => {
        try {
          const { data, error } = await this.supabase.client
            .from('sesiones')
            .select('*')
            .eq('id', idLimpio)
            .maybeSingle();

          if (error) throw error;
          if (!data) throw new Error('No se encontró la sesión solicitada.');
          if (activo) observer.next(sesionDtoToDomain(data));
        } catch (error) {
          console.error('Error al consultar la sesión en Supabase:', error);
          if (activo) observer.error(error);
        }
      };

      void cargarSesion();

      const intervalId = setInterval(() => {
        if (activo) void cargarSesion();
      }, 4000);

      const channel = this.supabase.client
        .channel(`sesion_estado_${idLimpio}_${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'sesiones', filter: `id=eq.${idLimpio}` },
          payload => {
            if (activo) observer.next(sesionDtoToDomain(payload.new as SesionDto));
          }
        )
        .subscribe((status, error) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Realtime Supabase] Aviso en el canal de sesión (${status}):`, error);
            void cargarSesion();
          }
        });

      return () => {
        activo = false;
        clearInterval(intervalId);
        void this.supabase.client.removeChannel(channel);
      };
    });
  }

  private async insertarParticipanteSeguro({
    sesionId,
    usuarioId,
    nombre,
    esOrganizador,
    listo
  }: {
    sesionId: string;
    usuarioId?: string | null;
    nombre?: string;
    esOrganizador: boolean;
    listo: boolean;
  }): Promise<Participante> {
    const sesionIdNormalizado = sesionId.trim();
    if (!sesionIdNormalizado) throw new Error('El ID de sesión es inválido');

    let usuarioIdNormalizado = usuarioId?.trim() || null;
    let nombreNormalizado = nombre?.trim() || '';

    if (!usuarioIdNormalizado || !nombreNormalizado) {
      const { data, error } = await this.supabase.client.auth.getUser();
      if (error) throw error;

      usuarioIdNormalizado ||= data.user?.id?.trim() || null;
      const nombreMetadata = data.user?.user_metadata?.['nombre'];
      nombreNormalizado ||= typeof nombreMetadata === 'string' ? nombreMetadata.trim() : '';
      nombreNormalizado ||= data.user?.email?.trim() || '';
    }

    nombreNormalizado ||= esOrganizador ? 'Organizador' : 'Catador';

    if (usuarioIdNormalizado) {
      const { data: existente, error } = await this.supabase.client
        .from('participantes')
        .select('*')
        .eq('sesion_id', sesionIdNormalizado)
        .eq('usuario_id', usuarioIdNormalizado)
        .maybeSingle();

      if (error) throw error;
      if (existente) return participanteDtoToDomain(existente);
    }

    const { data, error } = await this.supabase.client
      .from('participantes')
      .insert([{
        sesion_id: sesionIdNormalizado,
        usuario_id: usuarioIdNormalizado,
        nombre: nombreNormalizado,
        es_organizador: esOrganizador,
        listo,
        unido_en: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No se pudo registrar al participante en la sesión.');
    return participanteDtoToDomain(data);
  }

  private generarCodigoUnico(): string {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '0123456789';
    const alfanumerico = letras + numeros;
    const aleatorio = (caracteres: string) => {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      return caracteres[bytes[0] % caracteres.length];
    };

    return `${aleatorio(letras)}${aleatorio(letras)}${aleatorio(numeros)}${aleatorio(numeros)}-${aleatorio(numeros)}${aleatorio(alfanumerico)}${aleatorio(numeros)}`;
  }
}
