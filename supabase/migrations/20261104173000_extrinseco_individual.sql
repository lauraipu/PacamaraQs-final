-- =============================================================================
-- Extrínseco = evaluación individual (sin sala de espera ni código)
--
-- BUG: evaluar_cierre_automatico() salía con `estado <> 'en_progreso'`. Una
-- sesión extrínseca nunca pasa a 'en_progreso' (iniciar_sesion la rechaza y
-- puede_evaluar la deja evaluar en 'esperando'), así que al enviar la última
-- ficha la sesión quedaba para siempre en 'esperando': el dashboard la mostraba
-- "En espera" y get_resumen_panel respondía 22023 "Los resultados están
-- disponibles cuando el panel se cierra".
--
-- 1. evaluar_cierre_automatico: acepta 'esperando' cuando el formato es extrínseco.
-- 2. unirse_sesion: el código de una sesión extrínseca ya no admite terceros.
-- 3. Cierra las sesiones extrínsecas ya completas que quedaron atascadas.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.evaluar_cierre_automatico(p_sesion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sesion public.sesiones;
BEGIN
  SELECT * INTO v_sesion FROM public.sesiones WHERE id = p_sesion_id;
  IF v_sesion.id IS NULL THEN
    RETURN false;
  END IF;
  IF NOT (
    v_sesion.estado = 'en_progreso'
    OR (v_sesion.formato_cva = 'extrinseca' AND v_sesion.estado = 'esperando')
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.participantes WHERE sesion_id = p_sesion_id AND usuario_id IS NOT NULL) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.participantes p
    CROSS JOIN generate_series(1, v_sesion.numero_muestras) AS n
    WHERE p.sesion_id = p_sesion_id
      AND p.usuario_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.evaluaciones e
        WHERE e.sesion_id = p_sesion_id AND e.catador_id = p.usuario_id AND e.numero_muestra = n
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.cierres_muestra c
        WHERE c.sesion_id = p_sesion_id AND c.numero_muestra = n
      )
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.sesiones SET estado = 'completada' WHERE id = p_sesion_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.unirse_sesion(p_codigo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_sesion public.sesiones;
  v_fallos integer;
  v_nombre text;
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_fallos
  FROM public.intentos_union
  WHERE usuario_id = v_uid AND exitoso = false AND intentado_en > now() - interval '5 minutes';
  IF v_fallos >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos fallidos. Espera 5 minutos.' USING ERRCODE = '42501';
  END IF;

  -- Las sesiones extrínsecas son individuales: su código no admite catadores.
  SELECT * INTO v_sesion
  FROM public.sesiones
  WHERE codigo_sesion = v_codigo AND estado = 'esperando' AND formato_cva <> 'extrinseca';

  INSERT INTO public.intentos_union (usuario_id, codigo_intentado, exitoso)
  VALUES (v_uid, left(v_codigo, 32), v_sesion.id IS NOT NULL);

  IF v_sesion.id IS NULL THEN
    RAISE EXCEPTION 'Código inválido o la sesión ya inició.' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(nullif(trim(nombre), ''), split_part(email, '@', 1), 'Catador')
  INTO v_nombre FROM public.usuarios WHERE id = v_uid;

  INSERT INTO public.participantes (sesion_id, usuario_id, nombre, es_organizador, listo)
  VALUES (v_sesion.id, v_uid, coalesce(v_nombre, 'Catador'), v_sesion.organizador_id = v_uid, false)
  ON CONFLICT (sesion_id, usuario_id) DO NOTHING;

  RETURN v_sesion.id;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluar_cierre_automatico(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unirse_sesion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unirse_sesion(text) TO authenticated;

-- Sesiones extrínsecas que ya tienen todas sus fichas y quedaron en 'esperando'.
SELECT public.evaluar_cierre_automatico(s.id)
FROM public.sesiones s
WHERE s.formato_cva = 'extrinseca' AND s.estado = 'esperando';
