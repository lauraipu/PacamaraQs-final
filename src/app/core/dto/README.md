# DTO (Data Transfer Objects)

Forma **exacta** de lo que devuelve Supabase (tablas y funciones RPC), en `snake_case`
y con fechas como texto ISO. Todos los DTO de la app están en esta carpeta.

| Archivo | Lo usa |
|---|---|
| `sesion.dto.ts` | `core/data-access/sesiones/` (sesiones y participantes) |
| `admin.dto.ts` | `features/admin/data-access/` (RPC `admin_*`) |
| `perfil.dto.ts` | `features/perfil/data-access/` (tabla `usuarios`) |
| `resultados.dto.ts` | `features/resultados/data-access/` (RPC `get_resumen_panel`) |

Reglas:
- Un DTO solo describe datos: sin funciones ni lógica.
- Solo lo importan los `data-access/` (repositorio y mapper). El mapper lo convierte
  en el modelo de dominio y el repositorio entrega a las pantallas solo modelos.
- ESLint lo hace cumplir: páginas, componentes, modelos y `shared/` no pueden importar DTO.
