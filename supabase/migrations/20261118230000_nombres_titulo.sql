-- Nombres con mayúscula inicial en cada palabra, sin importar cómo se escriban
-- (registro, Google o edición del perfil). initcap respeta tildes y ñ.
-- Aplicada en Supabase el 2026-11-18.
CREATE OR REPLACE FUNCTION public.normalizar_nombre(p_nombre text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(initcap(lower(regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g'))), '');
$$;

CREATE OR REPLACE FUNCTION public.trg_normalizar_nombre_usuario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.nombre IS NOT NULL THEN
    NEW.nombre := coalesce(public.normalizar_nombre(NEW.nombre), NEW.nombre);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuarios_nombre ON public.usuarios;
CREATE TRIGGER trg_usuarios_nombre
  BEFORE INSERT OR UPDATE OF nombre ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalizar_nombre_usuario();

UPDATE public.usuarios
   SET nombre = public.normalizar_nombre(nombre)
 WHERE nombre IS NOT NULL AND nombre IS DISTINCT FROM public.normalizar_nombre(nombre);
