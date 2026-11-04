import {
  EstadoSesion,
  Participante,
  ParticipanteDto,
  Sesion,
  SesionDto
} from '../models/sesion.model';

export function sesionDtoToDomain(dto: SesionDto): Sesion {
  let estado: EstadoSesion;
  // Normalizamos el estado por si viene con mayúsculas o espacios
  const estadoNormalizado = (dto.estado || '').toLowerCase().trim();

  switch (estadoNormalizado) {
    case 'en_progreso':
      estado = EstadoSesion.INICIADA;
      break;
    case 'completada':
      estado = EstadoSesion.FINALIZADA;
      break;
    case 'cancelada':
      estado = EstadoSesion.CANCELADA;
      break;
    case 'esperando':
    default:
      estado = EstadoSesion.EN_ESPERA;
  }

  return {
    id: dto.id ?? '',
    codigoAcceso: dto.codigo_sesion,
    nombre: dto.nombre,
    notas: dto.notas ?? '',
    formato: dto.formato_cva,
    numeroMuestras: dto.numero_muestras,
    catadoresObjetivo: dto.catadores_objetivo,
    organizadorId: dto.organizador_id,
    organizadorParticipa: dto.organizador_participa,
    estado,
    creadaEn: dto.creado_en ?? undefined
  };
}

export function participanteDtoToDomain(dto: ParticipanteDto): Participante {
  return {
    id: dto.id ?? '',
    sesionId: dto.sesion_id,
    usuarioId: dto.usuario_id ?? '',
    nombre: dto.nombre,
    esOrganizador: dto.es_organizador ?? false,
    listo: dto.listo ?? false,
    unidoEn: dto.unido_en ?? undefined
  };
}
