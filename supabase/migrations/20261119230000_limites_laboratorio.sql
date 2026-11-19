-- Fase 3B · Límites del laboratorio.
-- Una fila de configuración que el administrador cambia desde el panel ("Uso y límites").
-- El servidor la hace cumplir con disparadores, así no hay que reescribir las RPC
-- que ya funcionan (crear_sesion, unirse_sesion, registrar_ficha_personal, registro):
--   · Pausa (manual o programada): no se crean sesiones, no se une nadie, no se
--     escanea y no hay registros nuevos. Las catas ya iniciadas sí pueden terminar
--     (registrar_evaluacion no se bloquea). Los administradores no se ven afectados.
--   · Máximo de sesiones abiertas (en espera o en progreso) por usuario.
--   · Límite de base de datos: al superarlo no se crean sesiones nuevas.
--   · Escaneos con IA por hora (0 = escáner apagado).
--   · Registros abiertos o cerrados.
-- Códigos de error propios: PA001 pausa · PA002 máximo de sesiones · PA003 base de
-- datos llena · PA004 registros cerrados.

CREATE TABLE IF NOT EXISTS public.configuracion_app (
  id                         smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pausada                    boolean     NOT NULL DEFAULT false,
  pausar_desde               timestamptz,
  mensaje_pausa              text        NOT NULL DEFAULT 'La plataforma está en pausa. Escribe a PacamaraQS@gmail.com si necesitas acceso.'
                               CHECK (char_length(mensaje_pausa) BETWEEN 5 AND 300),
  registros_abiertos         boolean     NOT NULL DEFAULT true,
  max_sesiones_abiertas      integer     NOT NULL DEFAULT 5   CHECK (max_sesiones_abiertas BETWEEN 1 AND 50),
  max_escaneos_hora          integer     NOT NULL DEFAULT 10  CHECK (max_escaneos_hora BETWEEN 0 AND 100),
  limite_bd_mb               integer     NOT NULL DEFAULT 400 CHECK (limite_bd_mb BETWEEN 50 AND 500),
  actualizado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_por            uuid
);
INSERT INTO public.configuracion_app (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Nadie la lee ni la escribe directo: solo por las funciones de abajo.
ALTER TABLE public.configuracion_app ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.configuracion_app FROM anon, authenticated;

-- ───────── Lectura ─────────
CREATE OR REPLACE FUNCTION public.app_en_pausa()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT coalesce((SELECT c.pausada OR (c.pausar_desde IS NOT NULL AND now() >= c.pausar_desde)
                   FROM public.configuracion_app c WHERE c.id = 1), false);
$$;

/** Estado visible para la app (aviso en el inicio). Solo usuarios autenticados. */
CREATE OR REPLACE FUNCTION public.estado_app()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'en_pausa', public.app_en_pausa(),
    'mensaje', c.mensaje_pausa,
    'pausar_desde', c.pausar_desde,
    'registros_abiertos', c.registros_abiertos
  ) FROM public.configuracion_app c WHERE c.id = 1;
$$;

-- ───────── Cumplimiento ─────────
CREATE OR REPLACE FUNCTION public.exigir_app_activa()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF public.app_en_pausa() AND NOT public.es_admin() THEN
    RAISE EXCEPTION '%', (SELECT mensaje_pausa FROM public.configuracion_app WHERE id = 1) USING ERRCODE = 'PA001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_limites_sesion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  c public.configuracion_app%ROWTYPE;
  v_abiertas integer;
BEGIN
  PERFORM public.exigir_app_activa();
  IF public.es_admin() THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.configuracion_app WHERE id = 1;

  IF pg_database_size(current_database()) > c.limite_bd_mb::bigint * 1024 * 1024 THEN
    RAISE EXCEPTION 'La base de datos llegó al límite configurado. No se pueden crear sesiones nuevas.' USING ERRCODE = 'PA003';
  END IF;

  -- Las sesiones personales (escáner) no cuentan: se cierran al guardarse.
  IF NOT coalesce(NEW.es_personal, false) THEN
    SELECT count(*) INTO v_abiertas FROM public.sesiones s
     WHERE s.organizador_id = NEW.organizador_id AND NOT s.es_personal
       AND s.estado IN ('esperando', 'en_progreso');
    IF v_abiertas >= c.max_sesiones_abiertas THEN
      RAISE EXCEPTION 'Alcanzaste el máximo de sesiones abiertas. Termina o elimina una antes de crear otra.' USING ERRCODE = 'PA002';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limites_sesion ON public.sesiones;
CREATE TRIGGER trg_limites_sesion BEFORE INSERT ON public.sesiones
  FOR EACH ROW EXECUTE FUNCTION public.trg_limites_sesion();

-- Unirse a una sesión en pausa (el organizador ya pasó por trg_limites_sesion).
CREATE OR REPLACE FUNCTION public.trg_pausa_participantes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  PERFORM public.exigir_app_activa();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pausa_participantes ON public.participantes;
CREATE TRIGGER trg_pausa_participantes BEFORE INSERT ON public.participantes
  FOR EACH ROW EXECUTE FUNCTION public.trg_pausa_participantes();

-- Registros nuevos (correo o Google). Corre antes de on_auth_user_created.
CREATE OR REPLACE FUNCTION public.trg_registros_abiertos()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NOT coalesce((SELECT registros_abiertos AND NOT public.app_en_pausa()
                   FROM public.configuracion_app WHERE id = 1), true) THEN
    RAISE EXCEPTION 'Los registros están cerrados por el administrador.' USING ERRCODE = 'PA004';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registros_abiertos ON auth.users;
CREATE TRIGGER trg_registros_abiertos BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_registros_abiertos();

-- Cuota del escáner: el límite lo decide la configuración (no quien llama).
CREATE OR REPLACE FUNCTION public.consumir_cuota_escaner(p_limite integer DEFAULT 10, p_ventana_min integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_usados int;
  v_limite int;
  v_ventana interval := make_interval(mins => least(greatest(coalesce(p_ventana_min, 60), 1), 1440));
  v_primero timestamptz;
BEGIN
  IF NOT public.es_usuario_real() THEN
    RAISE EXCEPTION 'Debes iniciar sesión con una cuenta registrada.' USING ERRCODE = '42501';
  END IF;
  IF public.app_en_pausa() AND NOT public.es_admin() THEN
    RETURN jsonb_build_object('permitido', false, 'motivo', 'pausa',
      'mensaje', (SELECT mensaje_pausa FROM public.configuracion_app WHERE id = 1));
  END IF;

  SELECT max_escaneos_hora INTO v_limite FROM public.configuracion_app WHERE id = 1;
  v_limite := coalesce(v_limite, least(greatest(coalesce(p_limite, 10), 1), 100));
  IF v_limite = 0 THEN
    RETURN jsonb_build_object('permitido', false, 'motivo', 'apagado', 'limite', 0);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  SELECT count(*), min(creado_en) INTO v_usados, v_primero
    FROM public.uso_escaner
   WHERE usuario_id = v_uid AND creado_en > now() - v_ventana;

  IF v_usados >= v_limite THEN
    RETURN jsonb_build_object('permitido', false, 'motivo', 'limite', 'usados', v_usados, 'limite', v_limite,
      'reintentar_en_s', greatest(1, ceil(extract(epoch FROM (v_primero + v_ventana - now())))::int));
  END IF;

  INSERT INTO public.uso_escaner (usuario_id) VALUES (v_uid);
  DELETE FROM public.uso_escaner WHERE usuario_id = v_uid AND creado_en < now() - interval '2 days';
  RETURN jsonb_build_object('permitido', true, 'usados', v_usados + 1, 'limite', v_limite);
END;
$$;

-- ───────── Panel del administrador ─────────
CREATE OR REPLACE FUNCTION public.admin_obtener_configuracion()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.exigir_admin();
  SELECT jsonb_build_object(
    'configuracion', to_jsonb(c) - 'id',
    'uso', jsonb_build_object(
      'en_pausa', public.app_en_pausa(),
      'tamano_bd_bytes', pg_database_size(current_database()),
      'sesiones_abiertas', (SELECT count(*) FROM public.sesiones WHERE estado IN ('esperando', 'en_progreso') AND NOT es_personal),
      'escaneos_24h', (SELECT count(*) FROM public.uso_escaner WHERE creado_en > now() - interval '24 hours'),
      'usuarios', (SELECT count(*) FROM public.usuarios WHERE activo),
      'evaluaciones', (SELECT count(*) FROM public.evaluaciones)
    )
  ) INTO v FROM public.configuracion_app c WHERE c.id = 1;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_guardar_configuracion(
  p_pausada boolean,
  p_pausar_desde timestamptz,
  p_mensaje_pausa text,
  p_registros_abiertos boolean,
  p_max_sesiones_abiertas integer,
  p_max_escaneos_hora integer,
  p_limite_bd_mb integer
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE anterior jsonb;
BEGIN
  PERFORM public.exigir_admin();
  SELECT to_jsonb(c) - 'id' - 'actualizado_en' - 'actualizado_por' INTO anterior FROM public.configuracion_app c WHERE c.id = 1;

  UPDATE public.configuracion_app SET
    pausada = coalesce(p_pausada, false),
    pausar_desde = p_pausar_desde,
    mensaje_pausa = btrim(p_mensaje_pausa),
    registros_abiertos = coalesce(p_registros_abiertos, true),
    max_sesiones_abiertas = p_max_sesiones_abiertas,
    max_escaneos_hora = p_max_escaneos_hora,
    limite_bd_mb = p_limite_bd_mb,
    actualizado_en = now(),
    actualizado_por = auth.uid()
  WHERE id = 1;

  INSERT INTO public.auditoria_eventos (tabla, operacion, registro_id, actor_id, datos)
  SELECT 'configuracion_app', 'CONFIGURACION', '1', auth.uid(),
         jsonb_build_object('anterior', anterior, 'nuevo', to_jsonb(c) - 'id' - 'actualizado_en' - 'actualizado_por')
    FROM public.configuracion_app c WHERE c.id = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.app_en_pausa() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.exigir_app_activa() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_limites_sesion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_pausa_participantes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_registros_abiertos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.estado_app() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_obtener_configuracion() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_guardar_configuracion(boolean, timestamptz, text, boolean, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_en_pausa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.estado_app() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_obtener_configuracion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_guardar_configuracion(boolean, timestamptz, text, boolean, integer, integer, integer) TO authenticated;
