-- =============================================================================
-- editar_sesion: también permite cambiar si el organizador participa como
-- catador (agrega o retira su fila en `participantes`).
-- Requiere 20261125150000_nombres_muestra_editar_sesion.sql.
-- =============================================================================

DROP FUNCTION IF EXISTS public.editar_sesion(uuid, text, text, text, integer, integer, text[]);

CREATE OR REPLACE FUNCTION public.editar_sesion(
  p_sesion_id uuid,
  p_nombre text,
  p_notas text,
  p_formato text,
  p_numero_muestras integer,
  p_catadores_objetivo integer,
  p_nombres_muestras text[] DEFAULT NULL,
  p_organizador_participa boolean DEFAULT NULL
)
 RETURNS public.sesiones
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_sesion     public.sesiones;
  v_formato    text := lower(trim(coalesce(p_formato, '')));
  v_participa  boolean;
  v_nombre_org text;
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sesion FROM public.sesiones WHERE id = p_sesion_id FOR UPDATE;
  IF v_sesion.id IS NULL THEN
    RAISE EXCEPTION 'La sesión no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_sesion.organizador_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo el organizador puede editar la sesión.' USING ERRCODE = '42501';
  END IF;
  IF v_sesion.estado <> 'esperando' THEN
    RAISE EXCEPTION 'La sesión ya inició: no se puede editar.' USING ERRCODE = '22023';
  END IF;
  IF v_sesion.es_personal OR v_sesion.formato_cva = 'extrinseca' THEN
    RAISE EXCEPTION 'Esta sesión no se edita desde la sala de espera.' USING ERRCODE = '22023';
  END IF;

  IF coalesce(trim(p_nombre), '') = '' THEN
    RAISE EXCEPTION 'El nombre de la sesión es obligatorio.' USING ERRCODE = '22023';
  END IF;
  IF v_formato NOT IN ('combinado', 'afectivo', 'descriptivo') THEN
    RAISE EXCEPTION 'Formato CVA inválido: %', p_formato USING ERRCODE = '22023';
  END IF;
  IF p_numero_muestras IS NULL OR p_numero_muestras < 1 OR p_numero_muestras > 20 THEN
    RAISE EXCEPTION 'El número de muestras debe estar entre 1 y 20.' USING ERRCODE = '22023';
  END IF;
  IF p_catadores_objetivo IS NULL OR p_catadores_objetivo < 1 THEN
    RAISE EXCEPTION 'Los catadores objetivo deben ser al menos 1.' USING ERRCODE = '22023';
  END IF;

  v_participa := coalesce(p_organizador_participa, v_sesion.organizador_participa);

  PERFORM set_config('app.editando_sesion', 'on', true);
  UPDATE public.sesiones
     SET nombre                = trim(p_nombre),
         notas                 = nullif(trim(coalesce(p_notas, '')), ''),
         formato_cva           = v_formato,
         numero_muestras       = p_numero_muestras,
         catadores_objetivo    = p_catadores_objetivo,
         organizador_participa = v_participa
   WHERE id = p_sesion_id
  RETURNING * INTO v_sesion;
  PERFORM set_config('app.editando_sesion', '', true);

  DELETE FROM public.muestras
   WHERE sesion_id = p_sesion_id AND numero_muestra > p_numero_muestras;
  INSERT INTO public.muestras (sesion_id, numero_muestra)
  SELECT p_sesion_id, n FROM generate_series(1, p_numero_muestras) AS n
  ON CONFLICT (sesion_id, numero_muestra) DO NOTHING;

  IF p_nombres_muestras IS NOT NULL THEN
    UPDATE public.muestras m
       SET nombre = nullif(left(trim(coalesce(p_nombres_muestras[m.numero_muestra], '')), 60), '')
     WHERE m.sesion_id = p_sesion_id;
  END IF;

  -- El organizador entra (listo) o sale del panel según su participación.
  IF v_participa THEN
    SELECT coalesce(nullif(trim(nombre), ''), 'Organizador') INTO v_nombre_org
    FROM public.usuarios WHERE id = v_sesion.organizador_id;
    INSERT INTO public.participantes (sesion_id, usuario_id, nombre, es_organizador, listo)
    VALUES (p_sesion_id, v_sesion.organizador_id, coalesce(v_nombre_org, 'Organizador'), true, true)
    ON CONFLICT (sesion_id, usuario_id) DO NOTHING;
  ELSE
    DELETE FROM public.participantes
     WHERE sesion_id = p_sesion_id AND usuario_id = v_sesion.organizador_id;
  END IF;

  RETURN v_sesion;
END;
$function$;

REVOKE ALL ON FUNCTION public.editar_sesion(uuid, text, text, text, integer, integer, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_sesion(uuid, text, text, text, integer, integer, text[], boolean) TO authenticated;
