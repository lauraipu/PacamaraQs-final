-- =============================================================================
-- Sesión Personal para fichas escaneadas (muestra individual, sin panel)
--
-- Por qué una RPC y no crear la sesión desde Angular:
--  · validar_estado_sesion exige 3 catadores listos para 'en_progreso' y solo
--    deja pasar 'esperando' → 'completada' al formato extrínseco.
--  · RLS (puede_evaluar) solo acepta fichas con la sesión 'en_progreso'.
-- Una sesión de 1 catador creada desde el cliente quedaba sin poder guardar
-- la ficha. Esta RPC crea sesión + muestra + participante + ficha + atributos
-- y la cierra en UNA transacción, marcada `es_personal = true`.
--
-- Seguridad:
--  · `es_personal` no tiene GRANT de UPDATE y no hay política INSERT en
--    sesiones: solo esta función puede activarla, y el trigger la hace inmutable.
--  · Una sesión personal no admite catadores (código no válido para unirse:
--    nace y se cierra en la misma transacción) ni puede pasar a 'en_progreso'.
--  · Rangos validados en el servidor; el puntaje CVA se recalcula aquí y no se
--    confía en el valor que envía el cliente.
-- =============================================================================

ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS es_personal boolean NOT NULL DEFAULT false;

ALTER TABLE public.sesiones DROP CONSTRAINT IF EXISTS sesiones_catadores_objetivo_check;
ALTER TABLE public.sesiones ADD CONSTRAINT sesiones_catadores_objetivo_check
  CHECK (catadores_objetivo >= 3 OR (es_personal AND catadores_objetivo >= 1));

CREATE OR REPLACE FUNCTION public.validar_estado_sesion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_listos integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.estado := 'esperando';
    RETURN NEW;
  END IF;

  IF NEW.organizador_id IS DISTINCT FROM OLD.organizador_id
     OR NEW.codigo_sesion IS DISTINCT FROM OLD.codigo_sesion
     OR NEW.formato_cva IS DISTINCT FROM OLD.formato_cva
     OR NEW.numero_muestras IS DISTINCT FROM OLD.numero_muestras
     OR NEW.es_personal IS DISTINCT FROM OLD.es_personal THEN
    RAISE EXCEPTION 'Organizador, código, formato, número de muestras y tipo de sesión no se pueden modificar.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  IF OLD.estado = 'esperando' AND NEW.estado = 'en_progreso' THEN
    IF OLD.formato_cva = 'extrinseca' THEN
      RAISE EXCEPTION 'El formato extrínseco es individual y no se inicia.' USING ERRCODE = '22023';
    END IF;
    IF OLD.es_personal THEN
      RAISE EXCEPTION 'Una sesión personal no se inicia como panel.' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_listos
    FROM public.participantes
    WHERE sesion_id = OLD.id AND listo = true AND usuario_id IS NOT NULL;
    IF v_listos < 3 THEN
      RAISE EXCEPTION 'Se necesitan al menos 3 catadores listos para iniciar (hay %).', v_listos
        USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.estado = 'esperando' AND NEW.estado = 'completada'
     AND (OLD.formato_cva = 'extrinseca' OR OLD.es_personal) THEN
    RETURN NEW;
  END IF;
  IF OLD.estado = 'esperando'   AND NEW.estado = 'cancelada'  THEN RETURN NEW; END IF;
  IF OLD.estado = 'en_progreso' AND NEW.estado = 'completada' THEN RETURN NEW; END IF;
  IF OLD.estado = 'en_progreso' AND NEW.estado = 'cancelada'  THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Transición de estado no permitida: % → %.', OLD.estado, NEW.estado
    USING ERRCODE = '22023';
END;
$$;

-- p_ficha = {
--   "impresion_global": 1–9 | null, "tazas_no_uniformes": 0–5, "tazas_defectuosas": 0–5,
--   "atributos": [{ "atributo": "fragancia", "intensidad": 0–15|null, "calidad": 1–9|null }, …],
--   "formulario": { … JSON del formulario de la app (descriptores, notas…) }
-- }
CREATE OR REPLACE FUNCTION public.registrar_ficha_personal(p_formato text, p_nombre text, p_ficha jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_formato    text := lower(trim(coalesce(p_formato, '')));
  v_nombre     text;
  v_nombre_usr text;
  v_codigo     text;
  v_sesion_id  uuid;
  v_eval_id    uuid;
  v_ig         numeric;
  v_u          integer;
  v_d          integer;
  v_atributo   jsonb;
  v_nombre_atr text;
  v_int        numeric;
  v_cal        numeric;
  v_calidades  numeric[] := '{}';
  v_puntaje    numeric;
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;
  IF v_formato NOT IN ('combinado', 'afectivo', 'descriptivo', 'extrinseca') THEN
    RAISE EXCEPTION 'Formato CVA inválido: %', p_formato USING ERRCODE = '22023';
  END IF;
  IF p_ficha IS NULL OR jsonb_typeof(p_ficha) <> 'object' THEN
    RAISE EXCEPTION 'La ficha escaneada está vacía.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_ficha -> 'atributos') NOT IN ('array', 'null') AND p_ficha ? 'atributos' THEN
    RAISE EXCEPTION 'Formato de atributos inválido.' USING ERRCODE = '22023';
  END IF;

  v_ig := nullif(p_ficha ->> 'impresion_global', '')::numeric;
  v_u  := coalesce(nullif(p_ficha ->> 'tazas_no_uniformes', '')::integer, 0);
  v_d  := coalesce(nullif(p_ficha ->> 'tazas_defectuosas', '')::integer, 0);
  IF v_ig IS NOT NULL AND (v_ig < 1 OR v_ig > 9) THEN
    RAISE EXCEPTION 'Impresión global fuera de rango (1–9).' USING ERRCODE = '22023';
  END IF;
  IF v_u NOT BETWEEN 0 AND 5 OR v_d NOT BETWEEN 0 AND 5 THEN
    RAISE EXCEPTION 'Tazas no uniformes / defectuosas deben estar entre 0 y 5.' USING ERRCODE = '22023';
  END IF;

  v_nombre := coalesce(
    nullif(left(trim(coalesce(p_nombre, '')), 120), ''),
    'Escaneo personal · ' || to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI')
  );

  -- Código interno con prefijo distinto al de las sesiones con panel.
  LOOP
    v_codigo := 'PX' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sesiones WHERE codigo_sesion = v_codigo);
  END LOOP;

  INSERT INTO public.sesiones (
    nombre, formato_cva, numero_muestras, catadores_objetivo,
    organizador_participa, codigo_sesion, organizador_id, estado, notas, es_personal
  ) VALUES (
    v_nombre, v_formato, 1, 1, true, v_codigo, v_uid, 'esperando', 'Ficha escaneada con IA', true
  )
  RETURNING id INTO v_sesion_id;

  INSERT INTO public.muestras (sesion_id, numero_muestra) VALUES (v_sesion_id, 1);

  SELECT coalesce(nullif(trim(nombre), ''), split_part(email, '@', 1), 'Catador')
  INTO v_nombre_usr FROM public.usuarios WHERE id = v_uid;

  INSERT INTO public.participantes (sesion_id, usuario_id, nombre, es_organizador, listo)
  VALUES (v_sesion_id, v_uid, coalesce(v_nombre_usr, 'Catador'), true, true);

  -- Calidades para el puntaje CVA (Combinado / Afectivo).
  FOR v_atributo IN SELECT * FROM jsonb_array_elements(coalesce(p_ficha -> 'atributos', '[]'::jsonb)) LOOP
    v_cal := nullif(v_atributo ->> 'calidad', '')::numeric;
    IF v_cal IS NOT NULL THEN v_calidades := v_calidades || v_cal; END IF;
  END LOOP;
  IF v_formato IN ('combinado', 'afectivo') AND cardinality(v_calidades) = 7 AND v_ig IS NOT NULL THEN
    v_puntaje := 0.65625 * ((SELECT sum(c) FROM unnest(v_calidades) c) + v_ig) + 52.75 - 2 * v_u - 4 * v_d;
    v_puntaje := greatest(0, least(100, round(v_puntaje * 4) / 4));
  END IF;

  INSERT INTO public.evaluaciones (
    sesion_id, catador_id, numero_muestra, impresion_global,
    tazas_no_uniformes, tazas_defectuosas, puntaje_final, notas
  ) VALUES (
    v_sesion_id, v_uid, 1, v_ig, v_u, v_d, v_puntaje,
    CASE WHEN jsonb_typeof(p_ficha -> 'formulario') = 'object' THEN (p_ficha -> 'formulario')::text END
  )
  RETURNING id INTO v_eval_id;

  FOR v_atributo IN SELECT * FROM jsonb_array_elements(coalesce(p_ficha -> 'atributos', '[]'::jsonb)) LOOP
    v_nombre_atr := v_atributo ->> 'atributo';
    v_int := nullif(v_atributo ->> 'intensidad', '')::numeric;
    v_cal := nullif(v_atributo ->> 'calidad', '')::numeric;
    IF v_nombre_atr NOT IN ('fragancia', 'aroma', 'sabor', 'sabor_residual', 'acidez', 'dulzor', 'sensacion_boca') THEN
      RAISE EXCEPTION 'Atributo desconocido: %', v_nombre_atr USING ERRCODE = '22023';
    END IF;
    IF (v_int IS NOT NULL AND (v_int < 0 OR v_int > 15)) OR (v_cal IS NOT NULL AND (v_cal < 1 OR v_cal > 9)) THEN
      RAISE EXCEPTION 'Valores fuera de rango en %.', v_nombre_atr USING ERRCODE = '22023';
    END IF;
    IF v_int IS NOT NULL OR v_cal IS NOT NULL THEN
      INSERT INTO public.evaluacion_atributos (evaluacion_id, atributo, intensidad, calidad)
      VALUES (v_eval_id, v_nombre_atr, v_int, v_cal)
      ON CONFLICT (evaluacion_id, atributo) DO UPDATE SET intensidad = excluded.intensidad, calidad = excluded.calidad;
    END IF;
  END LOOP;

  -- El trigger de evaluaciones ya cierra las extrínsecas; el resto se cierra aquí.
  UPDATE public.sesiones SET estado = 'completada' WHERE id = v_sesion_id AND estado <> 'completada';

  RETURN v_sesion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_ficha_personal(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ficha_personal(text, text, jsonb) TO authenticated;
