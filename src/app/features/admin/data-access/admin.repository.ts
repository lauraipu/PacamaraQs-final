import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.client';
import {
  AdminEventoDto, AdminResumenDto, AdminSesionDto, AdminUsuarioDto, PaginaDto, ResultadoEliminarUsuarioDto
} from '@core/dto/admin.dto';
import { AdminConfiguracionDto } from '@core/dto/configuracion.dto';
import { aConfiguracion, aEvento, aPagina, aResumen, aSesion, aUsuario } from './admin.mapper';
import {
  AdminConfiguracion, AdminEvento, AdminResumen, AdminSesion, AdminUsuario, ConfiguracionApp, FiltroAuditoria,
  FiltroSesiones, FiltroUsuarios, Pagina, ResultadoEliminarUsuario, RolAdminVista
} from '../models/admin.models';

/**
 * Único punto de acceso del panel de administrador a Supabase.
 * Todo pasa por funciones RPC `admin_*` (SECURITY DEFINER) que validan en el
 * servidor que el usuario sea administrador con verificación en dos pasos;
 * el cliente nunca consulta las tablas directamente desde estas pantallas.
 */
@Injectable({ providedIn: 'root' })
export class AdminRepository {
  private readonly supabase = inject(SupabaseService);

  async resumen(): Promise<AdminResumen> {
    return aResumen(await this.rpc<AdminResumenDto>('admin_resumen'));
  }

  async listarUsuarios(filtro: FiltroUsuarios, limite: number, desde: number): Promise<Pagina<AdminUsuario>> {
    const dto = await this.rpc<PaginaDto<AdminUsuarioDto>>('admin_listar_usuarios', {
      p_busqueda: filtro.busqueda?.trim() || null,
      p_rol: filtro.rol ?? null,
      p_limite: limite,
      p_desde: desde
    });
    return aPagina(dto, aUsuario);
  }

  async cambiarRol(usuarioId: string, rol: RolAdminVista): Promise<void> {
    await this.rpc<null>('admin_cambiar_rol', { p_usuario_id: usuarioId, p_rol: rol });
  }

  async editarUsuario(id: string, nombre: string, rol: RolAdminVista): Promise<void> {
    await this.rpc<null>('admin_editar_usuario', { p_id: id, p_nombre: nombre.trim(), p_rol: rol });
  }

  /** Borra al usuario si no tiene historial; si lo tiene, lo desactiva. */
  async eliminarUsuario(id: string): Promise<ResultadoEliminarUsuario> {
    const r = await this.rpc<ResultadoEliminarUsuarioDto>('admin_eliminar_usuario', { p_id: id });
    return r === 'eliminado' ? 'eliminado' : 'desactivado';
  }

  async reactivarUsuario(id: string): Promise<void> {
    await this.rpc<null>('admin_reactivar_usuario', { p_id: id });
  }

  async eliminarSesion(id: string): Promise<void> {
    await this.rpc<null>('admin_eliminar_sesion', { p_id: id });
  }

  async listarSesiones(filtro: FiltroSesiones, limite: number, desde: number): Promise<Pagina<AdminSesion>> {
    const dto = await this.rpc<PaginaDto<AdminSesionDto>>('admin_listar_sesiones', {
      p_busqueda: filtro.busqueda?.trim() || null,
      p_estado: filtro.estado ?? null,
      p_limite: limite,
      p_desde: desde
    });
    return aPagina(dto, aSesion);
  }

  async listarAuditoria(filtro: FiltroAuditoria, limite: number, desde: number): Promise<Pagina<AdminEvento>> {
    const dto = await this.rpc<PaginaDto<AdminEventoDto>>('admin_listar_auditoria', {
      p_tabla: filtro.tabla ?? null,
      p_operacion: filtro.operacion ?? null,
      p_limite: limite,
      p_desde: desde
    });
    return aPagina(dto, aEvento);
  }

  /** Configuración del laboratorio y medidores de uso actuales. */
  async obtenerConfiguracion(): Promise<AdminConfiguracion> {
    return aConfiguracion(await this.rpc<AdminConfiguracionDto>('admin_obtener_configuracion'));
  }

  /** Guarda la configuración; el servidor valida los rangos y deja registro en auditoría. */
  async guardarConfiguracion(c: ConfiguracionApp): Promise<void> {
    await this.rpc<null>('admin_guardar_configuracion', {
      p_pausada: c.pausada,
      p_pausar_desde: c.pausarDesde ? c.pausarDesde.toISOString() : null,
      p_mensaje_pausa: c.mensajePausa.trim(),
      p_registros_abiertos: c.registrosAbiertos,
      p_max_sesiones_abiertas: c.maxSesionesAbiertas,
      p_max_escaneos_hora: c.maxEscaneosHora,
      p_limite_bd_mb: c.limiteBdMb
    });
  }

  private async rpc<T>(funcion: string, params?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.client.rpc(funcion, params);
    if (error) throw error;
    return data as T;
  }
}
