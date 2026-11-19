-- Aplicada en Supabase el 2026-11-19.
-- Guías de primer uso vistas (preferencias.guias) y guardado de preferencias
-- que combina en vez de reemplazar.
CREATE OR REPLACE FUNCTION public.marcar_guia_vista(p_guia text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;
  IF p_guia IS NULL OR p_guia !~ '^[a-z_]{1,30}$' THEN
    RAISE EXCEPTION 'Guía inválida.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.usuarios u
     SET preferencias = jsonb_set(u.preferencias, '{guias}',
           coalesce(u.preferencias -> 'guias', '[]'::jsonb) || to_jsonb(p_guia))
   WHERE u.id = auth.uid()
     AND NOT coalesce(u.preferencias -> 'guias', '[]'::jsonb) ? p_guia;
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_preferencias(p_preferencias jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_preferencias) <> 'object' THEN
    RAISE EXCEPTION 'Preferencias inválidas.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.usuarios u
     SET preferencias = u.preferencias || (
           SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
             FROM jsonb_each(p_preferencias) AS e(k, v)
            WHERE k IN ('altoContraste', 'tamanoTexto', 'reducirAnimaciones'))
   WHERE u.id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_guia_vista(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guardar_preferencias(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_guia_vista(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_preferencias(jsonb) TO authenticated;
