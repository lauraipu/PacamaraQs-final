-- Límite persistente de escaneos por usuario (Edge Function analizar-ficha).
-- Aplicada en Supabase el 2026-11-16.
CREATE TABLE IF NOT EXISTS public.uso_escaner (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uso_escaner_usuario_fecha ON public.uso_escaner (usuario_id, creado_en DESC);
ALTER TABLE public.uso_escaner ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo la función de abajo (SECURITY DEFINER) lee y escribe.

CREATE OR REPLACE FUNCTION public.consumir_cuota_escaner(p_limite int DEFAULT 10, p_ventana_min int DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_usados int;
  v_limite int := least(greatest(coalesce(p_limite, 10), 1), 100);
  v_ventana interval := make_interval(mins => least(greatest(coalesce(p_ventana_min, 60), 1), 1440));
  v_primero timestamptz;
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  SELECT count(*), min(creado_en) INTO v_usados, v_primero
    FROM public.uso_escaner
   WHERE usuario_id = v_uid AND creado_en > now() - v_ventana;

  IF v_usados >= v_limite THEN
    RETURN jsonb_build_object('permitido', false, 'usados', v_usados, 'limite', v_limite,
      'reintentar_en_s', greatest(1, ceil(extract(epoch FROM (v_primero + v_ventana - now())))::int));
  END IF;

  INSERT INTO public.uso_escaner (usuario_id) VALUES (v_uid);
  DELETE FROM public.uso_escaner WHERE usuario_id = v_uid AND creado_en < now() - interval '2 days';
  RETURN jsonb_build_object('permitido', true, 'usados', v_usados + 1, 'limite', v_limite);
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_cuota_escaner(int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consumir_cuota_escaner(int, int) TO authenticated;
