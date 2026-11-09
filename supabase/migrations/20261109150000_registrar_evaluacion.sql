-- =============================================================================
-- Guardado atómico de fichas de panel + puntaje calculado en el servidor
--
-- BUG (confirmado: Catalina, muestra 3 → 0 atributos):
--   El cliente guardaba en DOS escrituras: 1) evaluaciones, 2) evaluacion_atributos.
--   Si esa ficha era la última del panel, el trigger AFTER INSERT
--   trg_evaluaciones_cierre pasaba la sesión a 'completada' entre ambas, y la
--   política de evaluacion_atributos (puede_evaluar → solo 'en_progreso')
--   rechazaba los atributos. El cliente lo tomaba como error permanente: el
--   puntaje quedaba guardado y los atributos se perdían. Le pasa siempre al
--   ÚLTIMO en enviar (normalmente el organizador).
--
-- ARREGLO: una RPC que valida, inserta la ficha y sus atributos en UNA
-- transacción. El cierre automático ocurre dentro de la misma transacción y
-- ya no puede dejar la ficha a medias.
--
-- SEGURIDAD: el puntaje CVA se recalcula aquí; el valor del cliente se ignora
-- (antes un catador podía enviar puntaje_final = 100 por la API).
-- =============================================================================

-- p_ficha = {
--   "impresion_global": 1–9 | null, "tazas_no_uniformes": 0–5, "tazas_defectuosas": 0–5,
--   "atributos": [{ "atributo": "fragancia", "intensidad": 0–15|null, "calidad": 1–9|null }, …],
--   "notas": "<JSON del formulario serializado>" | null
-- }
CREATE OR REPLACE FUNCTION public.registrar_evaluacion(p_sesion_id uuid, p_numero_muestra integer, p_ficha jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_formato    text;
  v_eval_id    uuid;
  v_ig         numeric;
  v_u          integer;
  v_d          integer;
  v_atributo   jsonb;
  v_nombre_atr text;
  v_int        numeric;
  v_cal        numeric;
  v_calidades  integer := 0;
  v_suma       numeric := 0;
  v_puntaje    numeric;
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;
  -- Misma regla que las políticas RLS: participante, sesión en curso (o
  -- extrínseca en espera) y muestra no cerrada.
  IF NOT public.puede_evaluar(p_sesion_id, p_numero_muestra) THEN
    RAISE EXCEPTION 'La sesión o la muestra ya no aceptan fichas.' USING ERRCODE = '42501';
  END IF;
  IF p_ficha IS NULL OR jsonb_typeof(p_ficha) <> 'object' THEN
    RAISE EXCEPTION 'La ficha está vacía.' USING ERRCODE = '22023';
  END IF;
  IF p_ficha ? 'atributos' AND jsonb_typeof(p_ficha -> 'atributos') NOT IN ('array', 'null') THEN
    RAISE EXCEPTION 'Formato de atributos inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT formato_cva INTO v_formato FROM public.sesiones WHERE id = p_sesion_id;

  v_ig := nullif(p_ficha ->> 'impresion_global', '')::numeric;
  v_u  := coalesce(nullif(p_ficha ->> 'tazas_no_uniformes', '')::integer, 0);
  v_d  := coalesce(nullif(p_ficha ->> 'tazas_defectuosas', '')::integer, 0);
  IF v_ig IS NOT NULL AND (v_ig < 1 OR v_ig > 9) THEN
    RAISE EXCEPTION 'Impresión global fuera de rango (1–9).' USING ERRCODE = '22023';
  END IF;
  IF v_u NOT BETWEEN 0 AND 5 OR v_d NOT BETWEEN 0 AND 5 THEN
    RAISE EXCEPTION 'Tazas no uniformes / defectuosas deben estar entre 0 y 5.' USING ERRCODE = '22023';
  END IF;

  -- Validación de atributos + suma de calidades (antes de escribir nada).
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
    IF v_cal IS NOT NULL THEN
      v_calidades := v_calidades + 1;
      v_suma := v_suma + v_cal;
    END IF;
  END LOOP;

  -- Puntaje CVA: S = 0.65625·(Σ7 calidades + impresión global) + 52.75 − 2u − 4d, redondeado a 0.25.
  IF v_formato IN ('combinado', 'afectivo') AND v_calidades = 7 AND v_ig IS NOT NULL THEN
    v_puntaje := 0.65625 * (v_suma + v_ig) + 52.75 - 2 * v_u - 4 * v_d;
    v_puntaje := greatest(0, least(100, round(v_puntaje * 4) / 4));
  END IF;

  INSERT INTO public.evaluaciones (
    sesion_id, catador_id, numero_muestra, impresion_global,
    tazas_no_uniformes, tazas_defectuosas, puntaje_final, notas
  ) VALUES (
    p_sesion_id, v_uid, p_numero_muestra, v_ig, v_u, v_d, v_puntaje, p_ficha ->> 'notas'
  )
  ON CONFLICT (sesion_id, catador_id, numero_muestra) DO UPDATE SET
    impresion_global   = excluded.impresion_global,
    tazas_no_uniformes = excluded.tazas_no_uniformes,
    tazas_defectuosas  = excluded.tazas_defectuosas,
    puntaje_final      = excluded.puntaje_final,
    notas              = excluded.notas
  RETURNING id INTO v_eval_id;

  -- Mismo transaction: aunque el trigger acabe de cerrar el panel, los
  -- atributos se guardan (la función es SECURITY DEFINER y ya validó arriba).
  FOR v_atributo IN SELECT * FROM jsonb_array_elements(coalesce(p_ficha -> 'atributos', '[]'::jsonb)) LOOP
    v_int := nullif(v_atributo ->> 'intensidad', '')::numeric;
    v_cal := nullif(v_atributo ->> 'calidad', '')::numeric;
    IF v_int IS NOT NULL OR v_cal IS NOT NULL THEN
      INSERT INTO public.evaluacion_atributos (evaluacion_id, atributo, intensidad, calidad)
      VALUES (v_eval_id, v_atributo ->> 'atributo', v_int, v_cal)
      ON CONFLICT (evaluacion_id, atributo) DO UPDATE SET intensidad = excluded.intensidad, calidad = excluded.calidad;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', v_eval_id, 'puntaje_final', v_puntaje);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_evaluacion(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_evaluacion(uuid, integer, jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- Cerrar la puerta de atrás: el puntaje ya no se puede escribir directamente
-- desde la API. Las fichas solo entran por registrar_evaluacion (o por
-- registrar_ficha_personal en sesiones personales).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS evaluaciones_insert_participante ON public.evaluaciones;
DROP POLICY IF EXISTS evaluaciones_update_participante ON public.evaluaciones;
DROP POLICY IF EXISTS atributos_write_propios ON public.evaluacion_atributos;
-- Lectura propia (evaluaciones_select_propias / atributos_select_propios) se mantiene.
