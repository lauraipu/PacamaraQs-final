-- =============================================================================
-- Aceptación de la política de tratamiento de datos (Ley 1581 de 2012)
--
-- Por qué: quien entra con Google no pasa por el formulario de registro, así
-- que no queda registro de su autorización. La app muestra la política la
-- primera vez y, al aceptar, llama a esta función, que deja constancia de
-- QUIÉN aceptó, CUÁNDO y QUÉ versión (prueba de la autorización, art. 9).
--
-- SECURITY DEFINER: usuarios no tiene política UPDATE para el cliente; la
-- función solo puede tocar la fila del propio usuario (auth.uid()).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.aceptar_politica(p_version text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_version), '') = '' OR length(p_version) > 20 THEN
    RAISE EXCEPTION 'Versión de política inválida.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.usuarios
     SET acepto_politica_en = now(),
         version_politica_aceptada = trim(p_version)
   WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.aceptar_politica(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceptar_politica(text) TO authenticated;
