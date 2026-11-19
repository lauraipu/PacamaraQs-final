import { EstadoAppDto } from '@core/dto/configuracion.dto';
import { EstadoApp } from './estado-app.model';

/** Traductor puro DTO → modelo. `ahora` se inyecta para poder probarlo. */
export function aEstadoApp(dto: EstadoAppDto | null | undefined, ahora = new Date()): EstadoApp | null {
  if (!dto) return null;
  const desde = dto.pausar_desde ? new Date(dto.pausar_desde) : null;
  const valida = desde && !Number.isNaN(desde.getTime()) ? desde : null;
  const enPausa = dto.en_pausa === true;
  return {
    enPausa,
    mensaje: dto.mensaje?.trim() ?? '',
    pausaProgramada: !enPausa && valida && valida.getTime() > ahora.getTime() ? valida : null,
    registrosAbiertos: dto.registros_abiertos !== false
  };
}
