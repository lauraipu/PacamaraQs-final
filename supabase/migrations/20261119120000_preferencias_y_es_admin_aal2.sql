-- Aplicadas en Supabase el 2026-11-18/19.
-- 1) Preferencias del usuario (Configuración): idioma y accesibilidad.
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'es'
    CHECK (idioma IN ('es','en','it','zh')),
  ADD COLUMN IF NOT EXISTS preferencias jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(preferencias) = 'object' AND pg_column_size(preferencias) < 2048);
GRANT UPDATE (idioma, preferencias) ON public.usuarios TO authenticated;

-- 2) Los permisos de administrador exigen sesión con verificación en dos pasos (aal2).
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     AND EXISTS (
       SELECT 1 FROM public.usuarios u
       WHERE u.id = auth.uid() AND u.rol_global = 'administrador'
     );
$function$;
