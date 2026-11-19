/**
 * Modelos de dominio del panel de administrador (camelCase, fechas como Date,
 * valores cerrados como uniones de texto). Es lo único que ven las pantallas.
 */

export type RolAdminVista = 'catador' | 'administrador';
export type EstadoSesionAdmin = 'esperando' | 'en_progreso' | 'completada' | 'cancelada';
export type FormatoSesionAdmin = 'combinado' | 'afectivo' | 'descriptivo' | 'extrinseca';
export type OperacionAuditoria =
  | 'INSERT' | 'UPDATE' | 'DELETE' | 'CAMBIO_ROL' | 'EDICION' | 'DESACTIVACION' | 'REACTIVACION' | 'ELIMINACION';
export type TablaAuditoria = 'sesiones' | 'participantes' | 'evaluaciones' | 'cierres_muestra' | 'usuarios';

export const ESTADOS_SESION: readonly EstadoSesionAdmin[] = ['esperando', 'en_progreso', 'completada', 'cancelada'];
export const FORMATOS_SESION: readonly FormatoSesionAdmin[] = ['combinado', 'afectivo', 'descriptivo', 'extrinseca'];
export const TABLAS_AUDITORIA: readonly TablaAuditoria[] = ['sesiones', 'participantes', 'evaluaciones', 'cierres_muestra', 'usuarios'];
export const OPERACIONES_AUDITORIA: readonly OperacionAuditoria[] = [
  'INSERT', 'UPDATE', 'DELETE', 'CAMBIO_ROL', 'EDICION', 'DESACTIVACION', 'REACTIVACION', 'ELIMINACION'
];

/** Estados de sesión que el administrador puede eliminar (el resto es historial). */
export const ESTADOS_ELIMINABLES: readonly EstadoSesionAdmin[] = ['esperando', 'en_progreso'];

/** Límite de base de datos del plan gratuito de Supabase (500 MB). */
export const LIMITE_BD_BYTES = 500 * 1024 * 1024;

export type { Pagina } from '@shared/utils/pagina';

export interface ActividadDia {
  dia: Date;
  sesiones: number;
  evaluaciones: number;
}

export interface AdminResumen {
  usuarios: number;
  administradores: number;
  usuariosNuevos7d: number;
  activos7d: number;
  sesiones: number;
  sesionesPorEstado: Record<EstadoSesionAdmin, number>;
  sesionesPorFormato: Record<FormatoSesionAdmin, number>;
  evaluaciones: number;
  evaluaciones7d: number;
  escaneos24h: number;
  escaneos7d: number;
  tamanoBdBytes: number;
  actividad14d: ActividadDia[];
}

export interface AdminUsuario {
  id: string;
  email: string;
  nombre: string;
  rol: RolAdminVista;
  activo: boolean;
  desactivadoEn: Date | null;
  creadoEn: Date;
  ultimoAcceso: Date | null;
  tieneDosPasos: boolean;
  sesionesOrganizadas: number;
  evaluaciones: number;
}

export interface AdminSesion {
  id: string;
  nombre: string;
  formato: FormatoSesionAdmin;
  estado: EstadoSesionAdmin;
  codigo: string | null;
  esPersonal: boolean;
  numeroMuestras: number;
  catadoresObjetivo: number;
  creadoEn: Date;
  organizador: string;
  catadores: number;
  listos: number;
  evaluaciones: number;
}

export interface AdminEvento {
  id: number;
  tabla: TablaAuditoria | string;
  operacion: OperacionAuditoria | string;
  registroId: string | null;
  sesionId: string | null;
  sesionNombre: string | null;
  actor: string;
  datos: Record<string, unknown>;
  creadoEn: Date;
}

/** 'desactivado': tenía historial y se conservó con el acceso bloqueado. */
export type ResultadoEliminarUsuario = 'eliminado' | 'desactivado';

export interface FiltroUsuarios {
  busqueda?: string;
  rol?: RolAdminVista | null;
}

export interface FiltroSesiones {
  busqueda?: string;
  estado?: EstadoSesionAdmin | null;
}

export interface FiltroAuditoria {
  tabla?: TablaAuditoria | null;
  operacion?: OperacionAuditoria | null;
}
