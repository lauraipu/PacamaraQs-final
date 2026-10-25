import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { participanteDtoToDomain, participanteToDto, sesionDtoToDomain, sesionToDto } from '../mappers/sesion.mapper';
import { EstadoSesion, Participante, Sesion } from '../models/sesion.model';
import { SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly supabase = inject(SupabaseService);

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
    usuarioId: string | null | undefined,
    nombre: string,
    esOrganizador: boolean
  ): Promise<void> {
    if (!sesionId || !sesionId.trim()) {
      throw new Error('El ID de sesión es inválido');
    }

    // Sanitización: un string vacío '' en un campo uuid provoca error 22P02 en PostgreSQL.
    // Debe enviarse null si no hay un UUID válido.
    const usuarioIdNormalizado = (usuarioId && usuarioId.trim()) ? usuarioId.trim() : null;

    const { error } = await this.supabase.client
      .from('participantes')
      .insert([{
        sesion_id: sesionId.trim(),
        usuario_id: usuarioIdNormalizado,
        nombre: nombre.trim(),
        es_organizador: esOrganizador,
        listo: true,
        unido_en: new Date().toISOString()
        // NUNCA enviar 'id' aquí: si se envía null viola NOT NULL (23502);
        // sin el campo, PostgreSQL ejecuta DEFAULT gen_random_uuid() correctamente.
      }]);

    if (error) throw error;
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
      let activo = true;
      const cargarParticipantes = async () => {
        const { data, error } = await this.supabase.client
          .from('participantes')
          .select('*')
          .eq('sesion_id', sesionId);

        if (error) {
          if (activo) observer.error(error);
          return;
        }
        if (activo) observer.next(data.map(participanteDtoToDomain));
      };

      void cargarParticipantes().catch(error => {
        if (activo) observer.error(error);
      });

      const channel = this.supabase.client
        .channel(`sala_espera_${sesionId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'participantes', filter: `sesion_id=eq.${sesionId}` },
          () => {
            void cargarParticipantes().catch(error => {
              if (activo) observer.error(error);
            });
          }
        )
        .subscribe((status, error) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            observer.error(error ?? new Error(`Falló la suscripción realtime: ${status}`));
          }
        });

      return () => {
        activo = false;
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
