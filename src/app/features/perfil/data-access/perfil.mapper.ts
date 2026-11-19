import { Perfil, Preferencias } from '../models/perfil.model';
import { PerfilDto } from '@core/dto/perfil.dto';

/** Traductor puro DTO → modelo. */
export function aPerfil(dto: PerfilDto): Perfil {
  return {
    nombre: dto.nombre,
    idioma: dto.idioma,
    preferencias: (dto.preferencias ?? {}) as Preferencias
  };
}
