/**
 * Roles globales de la app. rol_global solo admite estos dos valores
 * (CHECK en public.usuarios). "Organizador" NO es un rol global: es una
 * relación por sesión (sesiones.organizador_id) y la valida organizerGuard.
 */
export type RolGlobal = 'catador' | 'administrador';

/** Rutas de catación: catadores (y organizadores, que también son catadores). */
export const ROLES_APP: readonly RolGlobal[] = ['catador'];

/** Panel de administración. */
export const ROLES_ADMIN: readonly RolGlobal[] = ['administrador'];
