-- =============================================================================
-- Nombres de muestra, mínimo de 1 catador y edición de la sesión en espera.
--
--  · muestras.nombre: nombre libre (máx. 60) que el organizador da a cada
--    muestra ("Pacamara Huila", "Lote 3"…). NULL = "Muestra N".
--  · Catadores: el mínimo baja de 3 a 1. 3 o más (e impar) queda como
--    recomendación en la interfaz, no como regla del servidor.
--  · editar_sesion(): el organizador corrige nombre, notas, formato, número de
--    muestras, catadores objetivo, si participa como catador y nombres de
--    muestra mientras la sesión
--    está en 'esperando'. El trigger solo deja cambiar formato / número de
--    muestras cuando la escritura viene de esta función (app.editando_sesion),
--    para que `muestras` nunca quede desalineada con `numero_muestras`.
-- =============================================================================

-- 1. Nombre de muestra --------------------------------------------------------
ALTER TABLE public.muestras ADD COLUMN IF NOT EXISTS nombre text;
ALTER TABLE public.muestras DROP CONSTRAINT IF EXISTS muestras_nombre_check;
ALTER TABLE public.muestras ADD CONSTRAINT muestras_nombre_check
  CHECK (nombre IS NULL OR char_length(nombre) BETWEEN 1 AND 60);

-- 2. Mínimo de 1 catador -----------------------------------------------------
ALTER TABLE public.sesiones DROP CONSTRAINT IF EXISTS sesiones_catadores_objetivo_check;
ALTER TABLE public.sesiones ADD CONSTRAINT sesiones_catadores_objetivo_check
  CHECK (catadores_objetivo >= 1);

-- 3. Máquina de estados -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_estado_sesion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_listos   integer;
  v_editando boolean := coalesce(current_setting('app.editando_sesion', true), '') = 'on';
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.estado := 'esperando';
    RETURN NEW;
  END IF;

  IF NEW.organizador_id IS DISTINCT FROM OLD.organizador_id
     OR NEW.codigo_sesion IS DISTINCT FROM OLD.codigo_sesion
     OR NEW.es_personal IS DISTINCT FROM OLD.es_personal THEN
    RAISE EXCEPTION 'Organizador, código y tipo de sesión no se pueden modificar.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.formato_cva IS DISTINCT FROM OLD.formato_cva
     OR NEW.numero_muestras IS DISTINCT FROM OLD.numero_muestras THEN
    IF NOT v_editando
       OR OLD.estado <> 'esperando' OR NEW.estado <> 'esperando'
       OR OLD.es_personal
       OR OLD.formato_cva = 'extrinseca' OR NEW.formato_cva = 'extrinseca' THEN
      RAISE EXCEPTION 'El formato y el número de muestras solo se pueden cambiar desde la sala de espera, antes de iniciar.'
        USING ERRCODE = '42501';
    END IF;
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
    IF v_listos < 1 THEN
      RAISE EXCEPTION 'Se necesita al menos 1 catador listo para iniciar.' USING ERRCODE = '22023';
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
$function$;

-- 4. crear_sesion con nombres de muestra y mínimo 1 -------------------------
DROP FUNCTION IF EXISTS public.crear_sesion(text, text, integer, integer, boolean, text);

CREATE OR REPLACE FUNCTION public.crear_sesion(
  p_nombre text,
  p_formato text,
  p_numero_muestras integer,
  p_catadores_objetivo integer,
  p_organizador_participa boolean,
  p_notas text DEFAULT NULL,
  p_nombres_muestras text[] DEFAULT NULL
)
 RETURNS public.sesiones
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_formato    text := lower(trim(coalesce(p_formato, '')));
  v_participa  boolean;
  v_muestras   integer;
  v_codigo     text;
  v_letras     constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_digitos    constant text := '23456789';
  v_alfanum    constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_nombre_org text;
  v_sesion     public.sesiones;
  v_intentos   integer := 0;
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_nombre), '') = '' THEN
    RAISE EXCEPTION 'El nombre de la sesión es obligatorio.' USING ERRCODE = '22023';
  END IF;
  IF v_formato NOT IN ('combinado', 'afectivo', 'descriptivo', 'extrinseca') THEN
    RAISE EXCEPTION 'Formato CVA inválido: %', p_formato USING ERRCODE = '22023';
  END IF;

  v_participa := CASE WHEN v_formato = 'extrinseca' THEN false ELSE coalesce(p_organizador_participa, true) END;
  v_muestras  := CASE WHEN v_formato = 'extrinseca' THEN 1 ELSE p_numero_muestras END;
  IF v_muestras IS NULL OR v_muestras < 1 OR v_muestras > 20 THEN
    RAISE EXCEPTION 'El número de muestras debe estar entre 1 y 20.' USING ERRCODE = '22023';
  END IF;

  LOOP
    v_intentos := v_intentos + 1;
    v_codigo :=
      substr(v_letras,  1 + floor(random() * length(v_letras))::int, 1) ||
      substr(v_letras,  1 + floor(random() * length(v_letras))::int, 1) ||
      substr(v_digitos, 1 + floor(random() * length(v_digitos))::int, 1) ||
      substr(v_digitos, 1 + floor(random() * length(v_digitos))::int, 1) || '-' ||
      substr(v_digitos, 1 + floor(random() * length(v_digitos))::int, 1) ||
      substr(v_alfanum, 1 + floor(random() * length(v_alfanum))::int, 1) ||
      substr(v_digitos, 1 + floor(random() * length(v_digitos))::int, 1);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sesiones WHERE codigo_sesion = v_codigo);
    IF v_intentos > 20 THEN
      RAISE EXCEPTION 'No se pudo generar un código único. Intenta de nuevo.';
    END IF;
  END LOOP;

  INSERT INTO public.sesiones (
    nombre, formato_cva, numero_muestras, catadores_objetivo,
    organizador_participa, codigo_sesion, organizador_id, estado, notas
  ) VALUES (
    trim(p_nombre), v_formato, v_muestras, greatest(coalesce(p_catadores_objetivo, 1), 1),
    v_participa, v_codigo, v_uid, 'esperando', nullif(trim(coalesce(p_notas, '')), '')
  )
  RETURNING * INTO v_sesion;

  INSERT INTO public.muestras (sesion_id, numero_muestra, nombre)
  SELECT v_sesion.id, n, nullif(left(trim(coalesce(p_nombres_muestras[n], '')), 60), '')
  FROM generate_series(1, v_muestras) AS n;

  IF v_participa OR v_formato = 'extrinseca' THEN
    SELECT coalesce(nullif(trim(nombre), ''), 'Organizador') INTO v_nombre_org
    FROM public.usuarios WHERE id = v_uid;

    INSERT INTO public.participantes (sesion_id, usuario_id, nombre, es_organizador, listo)
    VALUES (v_sesion.id, v_uid, coalesce(v_nombre_org, 'Organizador'), true, true)
    ON CONFLICT (sesion_id, usuario_id) DO NOTHING;
  END IF;

  RETURN v_sesion;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_sesion(text, text, integer, integer, boolean, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_sesion(text, text, integer, integer, boolean, text, text[]) TO authenticated;

-- 5. editar_sesion ------------------------------------------------------------
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
     SET nombre             = trim(p_nombre),
         organizador_participa = v_participa,
         notas              = nullif(trim(coalesce(p_notas, '')), ''),
         formato_cva        = v_formato,
         numero_muestras    = p_numero_muestras,
         catadores_objetivo = p_catadores_objetivo
   WHERE id = p_sesion_id
  RETURNING * INTO v_sesion;
  PERFORM set_config('app.editando_sesion', '', true);

  DELETE FROM public.muestras
   WHERE sesion_id = p_sesion_id AND numero_muestra > p_numero_muestras;
  INSERT INTO public.muestras (sesion_id, numero_muestra)
  SELECT p_sesion_id, n FROM generate_series(1, p_numero_muestras) AS n
  ON CONFLICT (sesion_id, numero_muestra) DO NOTHING;

  -- El organizador entra (listo) o sale del panel según participe o no.
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

  IF p_nombres_muestras IS NOT NULL THEN
    UPDATE public.muestras m
       SET nombre = nullif(left(trim(coalesce(p_nombres_muestras[m.numero_muestra], '')), 60), '')
     WHERE m.sesion_id = p_sesion_id;
  END IF;

  RETURN v_sesion;
END;
$function$;

REVOKE ALL ON FUNCTION public.editar_sesion(uuid, text, text, text, integer, integer, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_sesion(uuid, text, text, text, integer, integer, text[], boolean) TO authenticated;
