-- =============================================================================
-- get_resumen_panel v4 — formulario completo de cada ficha (hoja SCA en PDF)
--
-- Cambio ADITIVO sobre v3 (20261104150000_resultados_por_formato.sql):
-- por_catador[].puntajes_por_muestra[] incluye `formulario`, el JSON que la
-- app guarda en evaluaciones.notas. Es la única fuente de los descriptores
-- (casillas Floral, Afrutado…), textura en boca, tipos de defecto y notas:
-- evaluacion_descriptores y evaluacion_defectos están vacías.
--
-- Mismas barreras: cuenta real + organizador/admin + panel 'completada'.
-- Los catadores siguen sin poder leer fichas ajenas (RLS "solo propias").
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_resumen_panel(p_sesion_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sesion        public.sesiones;
  v_es_admin      boolean;
  v_por_muestra   json;
  v_por_catador   json;
  v_por_atributo  json;
  v_votos         json;
  v_fichas_ext    json := '[]'::json;
  v_ext_registro  json := '[]'::json;
  v_prom_sesion   numeric;
BEGIN
  SELECT * INTO v_sesion FROM public.sesiones WHERE id = p_sesion_id;
  IF v_sesion.id IS NULL THEN
    RAISE EXCEPTION 'La sesión no existe.' USING ERRCODE = 'P0002';
  END IF;

  v_es_admin := EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid() AND u.rol_global = 'administrador'
  );

  IF NOT public.es_usuario_real()
     OR NOT (
       v_es_admin
       OR EXISTS (SELECT 1 FROM public.sesiones s WHERE s.id = p_sesion_id AND s.organizador_id = auth.uid())
     ) THEN
    RAISE EXCEPTION 'Solo el organizador puede ver los resultados del panel.' USING ERRCODE = '42501';
  END IF;
  IF v_sesion.estado <> 'completada' AND NOT v_es_admin THEN
    RAISE EXCEPTION 'Los resultados están disponibles cuando el panel se cierra.' USING ERRCODE = '22023';
  END IF;

  SELECT avg(e.puntaje_final) INTO v_prom_sesion
  FROM public.evaluaciones e
  JOIN public.participantes p ON p.sesion_id = e.sesion_id AND p.usuario_id = e.catador_id
  WHERE e.sesion_id = p_sesion_id;

  -- ── por_muestra (sin cambios) ─────────────────────────────────────────────
  SELECT coalesce(json_agg(t ORDER BY t.numero_muestra), '[]'::json) INTO v_por_muestra
  FROM (
    SELECT
      m.numero_muestra,
      m.nivel_tueste,
      count(e.puntaje_final)                                 AS evaluaciones_recibidas,
      (SELECT count(*) FROM public.participantes px
        WHERE px.sesion_id = p_sesion_id AND px.usuario_id IS NOT NULL) AS evaluaciones_esperadas,
      (count(e.puntaje_final) >= 5)                          AS recortado,
      round(avg(e.puntaje_final), 2)                         AS puntaje_promedio_simple,
      round(
        CASE
          WHEN count(e.puntaje_final) >= 5 THEN
            (sum(e.puntaje_final) - max(e.puntaje_final) - min(e.puntaje_final))
              / (count(e.puntaje_final) - 2)
          ELSE avg(e.puntaje_final)
        END, 2)                                              AS puntaje_promedio_panel,
      min(e.puntaje_final)                                   AS puntaje_min,
      max(e.puntaje_final)                                   AS puntaje_max,
      coalesce(round(stddev_samp(e.puntaje_final), 2), 0)    AS desviacion_estandar,
      EXISTS (SELECT 1 FROM public.cierres_muestra c
              WHERE c.sesion_id = p_sesion_id AND c.numero_muestra = m.numero_muestra) AS cerrada_forzada
    FROM public.muestras m
    LEFT JOIN (
      SELECT e.*
      FROM public.evaluaciones e
      JOIN public.participantes p ON p.sesion_id = e.sesion_id AND p.usuario_id = e.catador_id
      WHERE e.sesion_id = p_sesion_id
    ) e ON e.numero_muestra = m.numero_muestra
    WHERE m.sesion_id = p_sesion_id
    GROUP BY m.numero_muestra, m.nivel_tueste
  ) t;

  -- ── por_catador (+ impresion_global y atributos por ficha) ────────────────
  SELECT coalesce(json_agg(t ORDER BY t.es_organizador DESC, t.nombre), '[]'::json) INTO v_por_catador
  FROM (
    SELECT
      p.usuario_id                                         AS cupper_id,
      p.nombre,
      coalesce(p.es_organizador, false)                    AS es_organizador,
      count(e.id)                                          AS muestras_evaluadas,
      v_sesion.numero_muestras                             AS muestras_asignadas,
      CASE WHEN count(e.id) >= v_sesion.numero_muestras THEN 'enviado' ELSE 'pendiente' END AS estado,
      max(e.creado_en)                                     AS submitted_at,
      coalesce(round(avg(e.puntaje_final), 2), 0)          AS puntaje_promedio,
      coalesce(round(avg(e.puntaje_final) - v_prom_sesion, 2), 0) AS desviacion_respecto_panel,
      coalesce(json_agg(json_build_object(
        'numero_muestra',     e.numero_muestra,
        'puntaje',            e.puntaje_final,
        'tazas_no_uniformes', e.tazas_no_uniformes,
        'tazas_defectuosas',  e.tazas_defectuosas,
        'impresion_global',   e.impresion_global,
        'formulario',         CASE WHEN e.notas IS JSON OBJECT THEN e.notas::json END,
        'atributos', coalesce((
          SELECT json_object_agg(a.atributo, json_build_object('intensidad', a.intensidad, 'calidad', a.calidad))
          FROM public.evaluacion_atributos a
          WHERE a.evaluacion_id = e.id
        ), '{}'::json)
      ) ORDER BY e.numero_muestra) FILTER (WHERE e.id IS NOT NULL), '[]'::json) AS puntajes_por_muestra
    FROM public.participantes p
    LEFT JOIN public.evaluaciones e
      ON e.sesion_id = p.sesion_id AND e.catador_id = p.usuario_id
    WHERE p.sesion_id = p_sesion_id
      AND p.usuario_id IS NOT NULL
    GROUP BY p.usuario_id, p.nombre, p.es_organizador
  ) t;

  -- ── por_atributo: promedios de intensidad (0–15) y calidad (1–9) ──────────
  SELECT coalesce(json_agg(t ORDER BY t.numero_muestra, t.atributo), '[]'::json) INTO v_por_atributo
  FROM (
    SELECT
      e.numero_muestra,
      a.atributo,
      count(*)                       AS respuestas,
      round(avg(a.intensidad), 2)    AS intensidad_promedio,
      round(avg(a.calidad), 2)       AS calidad_promedio
    FROM public.evaluaciones e
    JOIN public.participantes p ON p.sesion_id = e.sesion_id AND p.usuario_id = e.catador_id
    JOIN public.evaluacion_atributos a ON a.evaluacion_id = e.id
    WHERE e.sesion_id = p_sesion_id
    GROUP BY e.numero_muestra, a.atributo
  ) t;

  -- ── votos_hedonicos: distribución de la Impresión Global (1–9) ────────────
  SELECT coalesce(json_agg(t ORDER BY t.numero_muestra, t.valor DESC), '[]'::json) INTO v_votos
  FROM (
    SELECT
      e.numero_muestra,
      round(e.impresion_global)::int AS valor,
      count(*)                       AS votos
    FROM public.evaluaciones e
    JOIN public.participantes p ON p.sesion_id = e.sesion_id AND p.usuario_id = e.catador_id
    WHERE e.sesion_id = p_sesion_id
      AND e.impresion_global BETWEEN 1 AND 9
    GROUP BY e.numero_muestra, round(e.impresion_global)::int
  ) t;

  -- ── Extrínseco: ficha técnica (solo en ese formato) ───────────────────────
  IF v_sesion.formato_cva = 'extrinseca' THEN
    SELECT coalesce(json_agg(t ORDER BY t.numero_muestra, t.nombre), '[]'::json) INTO v_fichas_ext
    FROM (
      SELECT
        e.numero_muestra,
        p.nombre,
        e.creado_en AS registrado_en,
        CASE WHEN e.notas IS JSON OBJECT THEN e.notas::json END AS formulario
      FROM public.evaluaciones e
      JOIN public.participantes p ON p.sesion_id = e.sesion_id AND p.usuario_id = e.catador_id
      WHERE e.sesion_id = p_sesion_id
    ) t;

    SELECT coalesce(json_agg(t ORDER BY t.numero_muestra), '[]'::json) INTO v_ext_registro
    FROM (
      SELECT
        m.numero_muestra,
        (to_jsonb(x) - 'id' - 'muestra_id' - 'creado_por') AS datos,
        coalesce((
          SELECT json_agg(c.nombre ORDER BY c.nombre)
          FROM public.muestra_certificaciones mc
          JOIN public.certificaciones c ON c.id = mc.certificacion_id
          WHERE mc.evaluacion_extrinseca_id = x.id
        ), '[]'::json) AS certificaciones
      FROM public.evaluacion_extrinseca x
      JOIN public.muestras m ON m.id = x.muestra_id
      WHERE m.sesion_id = p_sesion_id
    ) t;
  END IF;

  RETURN json_build_object(
    'por_muestra',           v_por_muestra,
    'por_catador',           v_por_catador,
    'por_atributo',          v_por_atributo,
    'votos_hedonicos',       v_votos,
    'fichas_extrinsecas',    v_fichas_ext,
    'extrinseca_registrada', v_ext_registro
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_resumen_panel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_resumen_panel(uuid) TO authenticated;
