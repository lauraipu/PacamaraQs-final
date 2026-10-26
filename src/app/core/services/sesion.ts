import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { participanteDtoToDomain, participanteToDto, sesionDtoToDomain, sesionToDto } from '../mappers/sesion.mapper';
import { EstadoSesion, Participante, Sesion, SesionDto } from '../models/sesion.model';
import { SupabaseService } from './supabase';

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
  ): Promise<Participante | void> {
    // 1. Validar que el ID de la sesión no esté vacío
    if (!sesionId || !sesionId.trim()) {
      throw new Error('El ID de sesión es inválido');
    }

    // 2. Limpiar el usuarioId (evitar enviar strings vacíos "")
    let usuarioIdNormalizado = (usuarioId && usuarioId.trim()) ? usuarioId.trim() : null;
    let nombreFinal = (nombre && nombre.trim()) ? nombre.trim() : '';

    // 3. Si no hay usuarioId, lo obtenemos de la sesión activa de Supabase
    if (!usuarioIdNormalizado) {
      try {
        const { data: authData } = await this.supabase.client.auth.getUser();
        if (authData?.user?.id) {
          usuarioIdNormalizado = authData.user.id.trim();
        }
      } catch (error) {
        console.warn("No se pudo obtener el usuario de Auth", error);
      }
    }

    // 4. Si no hay nombre, lo buscamos en la tabla de usuarios
    if (!nombreFinal && usuarioIdNormalizado) {
      try {
        const { data: perfil } = await this.supabase.client
          .from('Usuarios') // <-- OJO: Tu tabla en Android se llama Usuarios (con mayúscula)
          .select('nombre')
          .eq('id', usuarioIdNormalizado)
          .maybeSingle();

        if (perfil?.nombre && typeof perfil.nombre === 'string') {
          nombreFinal = perfil.nombre.trim();
        }
      } catch (error) {
        console.warn("No se pudo obtener el nombre del perfil", error);
      }
    }

    // 5. Si después de todo no hay nombre, usamos un default
    if (!nombreFinal) {
      nombreFinal = esOrganizador ? 'Organizador' : 'Catador';
    }

    // 6. Insertar en Supabase (SIN enviar el id, y con la fecha)
    const nuevoParticipante = {
      sesion_id: sesionId.trim(),
      usuario_id: usuarioIdNormalizado,
      nombre: nombreFinal,
      es_organizador: esOrganizador,
      listo: listo,
      unido_en: new Date().toISOString()
    };

    const { data, error } = await this.supabase.client
      .from('participantes')
      .insert([nuevoParticipante])
      .select();

    // 7. Manejo de errores
    if (error) throw error;

    // 8. Si todo sale bien, convertimos la respuesta de Supabase a nuestro modelo y la devolvemos
    if (data && data.length > 0) {
      return participanteDtoToDomain(data[0]);
    }
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

  async obtenerMisSesiones(usuarioId: string): Promise<Sesion[]> {
    const { data, error } = await this.supabase.client
      .from('sesiones')
      .select('*')
      .eq('organizador_id', usuarioId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return data.map(sesionDtoToDomain);
  }

  async unirseASesion(
    codigo: string,
    nombreCatador: string
  ): Promise<{ sesion: Sesion; participante: Participante }> {
    const codigoNormalizado = codigo.trim().toUpperCase();
    const nombre = nombreCatador.trim();
    if (!codigoNormalizado || !nombre) {
      throw new Error('El código y el nombre son obligatorios');
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

    // Sanitización estricta: string vacío '' en campo uuid genera error 22P02 en PostgreSQL.
    const usuarioIdNormalizado = (user?.id && user.id.trim()) ? user.id.trim() : null;

    // IDEMPOTENCIA: Si este usuario ya está registrado en la sesión, lo retornamos directamente.
    // Evita la violación de la restricción UNIQUE (sesion_id, usuario_id) → error 23505.
    if (usuarioIdNormalizado) {
      const { data: existente } = await this.supabase.client
        .from('participantes')
        .select('*')
        .eq('sesion_id', sesion.id)
        .eq('usuario_id', usuarioIdNormalizado)
        .maybeSingle();

      if (existente) {
        return { sesion, participante: participanteDtoToDomain(existente) };
      }
    }

    // NUNCA enviar el campo 'id': si se envía null, PostgreSQL lanza NOT NULL violation (23502).
    // Sin el campo, se ejecuta DEFAULT gen_random_uuid() automáticamente.
    const { data, error } = await this.supabase.client
      .from('participantes')
      .insert([{
        sesion_id: sesion.id,
        usuario_id: usuarioIdNormalizado,
        nombre,
        es_organizador: false,
        listo: true,
        unido_en: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return { sesion, participante: participanteDtoToDomain(data) };
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
