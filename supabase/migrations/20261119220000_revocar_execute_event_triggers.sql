-- Seguridad: las funciones de event trigger las ejecuta Postgres al hacer DDL;
-- nadie debe poder llamarlas por la API (/rest/v1/rpc/...). Quitar EXECUTE no
-- afecta a los disparadores (ensure_rls y event_trigger_name siguen activos).
-- Aplicada en Supabase el 2026-11-19.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_trigger_fn() FROM PUBLIC, anon, authenticated;
