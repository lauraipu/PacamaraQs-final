import {
  AdminEventoDto, AdminResumenDto, AdminSesionDto, AdminUsuarioDto, PaginaDto
} from '@core/dto/admin.dto';
import { AdminConfiguracionDto } from '@core/dto/configuracion.dto';
import {
  AdminConfiguracion, AdminEvento, AdminResumen, AdminSesion, AdminUsuario, ESTADOS_SESION, EstadoSesionAdmin,
  FORMATOS_SESION, FormatoSesionAdmin, Pagina
} from '../models/admin.models';

/** Convierte las respuestas de las RPC (DTO) en modelos de dominio. */

const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

const fecha = (valor: string | null | undefined): Date | null => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

function conteoPorClave<K extends string>(claves: readonly K[], origen: Record<string, number> | null | undefined): Record<K, number> {
  const resultado = {} as Record<K, number>;
  for (const clave of claves) resultado[clave] = numero(origen?.[clave]);
  return resultado;
}

const estado = (valor: string): EstadoSesionAdmin =>
  (ESTADOS_SESION as readonly string[]).includes(valor) ? valor as EstadoSesionAdmin : 'esperando';

const formato = (valor: string): FormatoSesionAdmin =>
  (FORMATOS_SESION as readonly string[]).includes(valor) ? valor as FormatoSesionAdmin : 'combinado';

export function aPagina<D, M>(dto: PaginaDto<D> | null | undefined, mapear: (fila: D) => M): Pagina<M> {
  return {
    total: numero(dto?.total),
    filas: (dto?.filas ?? []).map(mapear)
  };
}

export function aResumen(dto: AdminResumenDto): AdminResumen {
  return {
    usuarios: numero(dto.usuarios),
    administradores: numero(dto.administradores),
    usuariosNuevos7d: numero(dto.usuarios_nuevos_7d),
    activos7d: numero(dto.activos_7d),
    sesiones: numero(dto.sesiones),
    sesionesPorEstado: conteoPorClave(ESTADOS_SESION, dto.sesiones_por_estado),
    sesionesPorFormato: conteoPorClave(FORMATOS_SESION, dto.sesiones_por_formato),
    evaluaciones: numero(dto.evaluaciones),
    evaluaciones7d: numero(dto.evaluaciones_7d),
    escaneos24h: numero(dto.escaneos_24h),
    escaneos7d: numero(dto.escaneos_7d),
    tamanoBdBytes: numero(dto.tamano_bd_bytes),
    actividad14d: (dto.actividad_14d ?? []).map(d => ({
      dia: fecha(`${d.dia}T12:00:00`) ?? new Date(),
      sesiones: numero(d.sesiones),
      evaluaciones: numero(d.evaluaciones)
    }))
  };
}

export function aUsuario(dto: AdminUsuarioDto): AdminUsuario {
  return {
    id: dto.id,
    email: dto.email,
    nombre: dto.nombre?.trim() || null,
    rol: dto.rol_global === 'administrador' ? 'administrador' : 'catador',
    activo: dto.activo !== false,
    desactivadoEn: fecha(dto.desactivado_en),
    creadoEn: fecha(dto.creado_en) ?? new Date(0),
    ultimoAcceso: fecha(dto.ultimo_acceso),
    tieneDosPasos: !!dto.tiene_dos_pasos,
    sesionesOrganizadas: numero(dto.sesiones_organizadas),
    evaluaciones: numero(dto.evaluaciones)
  };
}

export function aSesion(dto: AdminSesionDto): AdminSesion {
  return {
    id: dto.id,
    nombre: dto.nombre,
    formato: formato(dto.formato_cva),
    estado: estado(dto.estado),
    codigo: dto.codigo_sesion,
    esPersonal: !!dto.es_personal,
    numeroMuestras: numero(dto.numero_muestras),
    catadoresObjetivo: numero(dto.catadores_objetivo),
    creadoEn: fecha(dto.creado_en) ?? new Date(0),
    organizador: dto.organizador_nombre?.trim() || dto.organizador_email || null,
    catadores: numero(dto.catadores),
    listos: numero(dto.listos),
    evaluaciones: numero(dto.evaluaciones)
  };
}

export function aConfiguracion(dto: AdminConfiguracionDto): AdminConfiguracion {
  const c = dto.configuracion;
  const u = dto.uso;
  return {
    configuracion: {
      pausada: c.pausada === true,
      pausarDesde: fecha(c.pausar_desde),
      mensajePausa: c.mensaje_pausa ?? '',
      registrosAbiertos: c.registros_abiertos !== false,
      maxSesionesAbiertas: numero(c.max_sesiones_abiertas),
      maxEscaneosHora: numero(c.max_escaneos_hora),
      limiteBdMb: numero(c.limite_bd_mb)
    },
    actualizadoEn: fecha(c.actualizado_en),
    uso: {
      enPausa: u?.en_pausa === true,
      tamanoBdBytes: numero(u?.tamano_bd_bytes),
      sesionesAbiertas: numero(u?.sesiones_abiertas),
      escaneos24h: numero(u?.escaneos_24h),
      usuarios: numero(u?.usuarios),
      evaluaciones: numero(u?.evaluaciones)
    }
  };
}

export function aEvento(dto: AdminEventoDto): AdminEvento {
  return {
    id: numero(dto.id),
    tabla: dto.tabla,
    operacion: dto.operacion,
    registroId: dto.registro_id,
    sesionId: dto.sesion_id,
    sesionNombre: dto.sesion_nombre,
    actor: dto.actor_nombre?.trim() || dto.actor_email || null,
    datos: dto.datos ?? {},
    creadoEn: fecha(dto.creado_en) ?? new Date(0)
  };
}
