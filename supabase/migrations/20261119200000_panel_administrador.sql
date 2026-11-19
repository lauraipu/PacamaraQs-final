-- Fase 3 · Panel de administrador.
-- Todas las funciones son SECURITY DEFINER y empiezan validando es_admin(),
-- que exige rol 'administrador' Y sesión con verificación en dos pasos (aal2).
-- Ningún dato sale si esa validación falla (error 42501).

CREATE OR REPLACE FUNCTION public.exigir_admin()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Acceso restringido a administradores con verificación en dos pasos'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ───────── Resumen ─────────
CREATE OR REPLACE FUNCTION public.admin_resumen()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v jsonb;
BEGIN
  PERFORM public.exigir_admin();

  SELECT jsonb_build_object(
    'usuarios', (SELECT count(*) FROM public.usuarios),
    'administradores', (SELECT count(*) FROM public.usuarios WHERE rol_global = 'administrador'),
    'usuarios_nuevos_7d', (SELECT count(*) FROM public.usuarios WHERE creado_en >= now() - interval '7 days'),
    'activos_7d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '7 days'),
    'sesiones', (SELECT count(*) FROM public.sesiones),
    'sesiones_por_estado', coalesce((
      SELECT jsonb_object_agg(estado, n) FROM (
        SELECT estado, count(*) n FROM public.sesiones GROUP BY estado) x), '{}'::jsonb),
    'sesiones_por_formato', coalesce((
      SELECT jsonb_object_agg(formato_cva, n) FROM (
        SELECT formato_cva, count(*) n FROM public.sesiones GROUP BY formato_cva) x), '{}'::jsonb),
    'evaluaciones', (SELECT count(*) FROM public.evaluaciones),
    'evaluaciones_7d', (SELECT count(*) FROM public.evaluaciones WHERE creado_en >= now() - interval '7 days'),
    'escaneos_24h', (SELECT count(*) FROM public.uso_escaner WHERE creado_en >= now() - interval '24 hours'),
    'escaneos_7d', (SELECT count(*) FROM public.uso_escaner WHERE creado_en >= now() - interval '7 days'),
    'tamano_bd_bytes', pg_database_size(current_database()),
    'actividad_14d', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'dia', d::date,
               'sesiones', (SELECT count(*) FROM public.sesiones s WHERE s.creado_en::date = d::date),
               'evaluaciones', (SELECT count(*) FROM public.evaluaciones e WHERE e.creado_en::date = d::date)
             ) ORDER BY d), '[]'::jsonb)
      FROM generate_series(current_date - 13, current_date, interval '1 day') d)
  ) INTO v;

  RETURN v;
END;
$$;

-- ───────── Usuarios ─────────
CREATE OR REPLACE FUNCTION public.admin_listar_usuarios(
  p_busqueda text DEFAULT NULL,
  p_rol text DEFAULT NULL,
  p_limite integer DEFAULT 25,
  p_desde integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_filtro text := nullif(btrim(p_busqueda), '');
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_desde integer := greatest(coalesce(p_desde, 0), 0);
  v_total bigint;
  v_filas jsonb;
BEGIN
  PERFORM public.exigir_admin();

  SELECT count(*) INTO v_total
  FROM public.usuarios u
  WHERE (v_filtro IS NULL OR u.nombre ILIKE '%' || v_filtro || '%' OR u.email ILIKE '%' || v_filtro || '%')
    AND (p_rol IS NULL OR u.rol_global = p_rol);

  SELECT coalesce(jsonb_agg(f ORDER BY f.creado_en DESC), '[]'::jsonb) INTO v_filas
  FROM (
    SELECT b.id, b.email, b.nombre, b.rol_global, b.creado_en, b.idioma,
           au.last_sign_in_at AS ultimo_acceso,
           EXISTS (SELECT 1 FROM auth.mfa_factors f
                   WHERE f.user_id = b.id AND f.status = 'verified') AS tiene_dos_pasos,
           (SELECT count(*) FROM public.sesiones s WHERE s.organizador_id = b.id) AS sesiones_organizadas,
           (SELECT count(*) FROM public.evaluaciones e WHERE e.catador_id = b.id) AS evaluaciones
    FROM public.usuarios b
    LEFT JOIN auth.users au ON au.id = b.id
    WHERE (v_filtro IS NULL OR b.nombre ILIKE '%' || v_filtro || '%' OR b.email ILIKE '%' || v_filtro || '%')
      AND (p_rol IS NULL OR b.rol_global = p_rol)
    ORDER BY b.creado_en DESC
    LIMIT v_limite OFFSET v_desde
  ) f;

  RETURN jsonb_build_object('total', v_total, 'filas', v_filas);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cambiar_rol(p_usuario_id uuid, p_rol text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_anterior text;
BEGIN
  PERFORM public.exigir_admin();

  IF p_rol NOT IN ('catador', 'administrador') THEN
    RAISE EXCEPTION 'Rol no válido' USING ERRCODE = '22023';
  END IF;
  IF p_usuario_id = auth.uid() THEN
    -- Evita que el administrador se quite el acceso a sí mismo por error.
    RAISE EXCEPTION 'No puedes cambiar tu propio rol' USING ERRCODE = '42501';
  END IF;

  SELECT rol_global INTO v_anterior FROM public.usuarios WHERE id = p_usuario_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_anterior = p_rol THEN
    RETURN;
  END IF;

  UPDATE public.usuarios SET rol_global = p_rol WHERE id = p_usuario_id;

  INSERT INTO public.auditoria_eventos (tabla, operacion, registro_id, sesion_id, actor_id, datos)
  VALUES ('usuarios', 'CAMBIO_ROL', p_usuario_id::text, NULL, auth.uid(),
          jsonb_build_object('rol_anterior', v_anterior, 'rol_nuevo', p_rol));
END;
$$;

-- ───────── Sesiones ─────────
CREATE OR REPLACE FUNCTION public.admin_listar_sesiones(
  p_busqueda text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_limite integer DEFAULT 25,
  p_desde integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_filtro text := nullif(btrim(p_busqueda), '');
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_desde integer := greatest(coalesce(p_desde, 0), 0);
  v_total bigint;
  v_filas jsonb;
BEGIN
  PERFORM public.exigir_admin();

  SELECT count(*) INTO v_total
  FROM public.sesiones s
  LEFT JOIN public.usuarios u ON u.id = s.organizador_id
  WHERE (p_estado IS NULL OR s.estado = p_estado)
    AND (v_filtro IS NULL OR s.nombre ILIKE '%' || v_filtro || '%'
         OR s.codigo_sesion ILIKE '%' || v_filtro || '%'
         OR u.nombre ILIKE '%' || v_filtro || '%');

  SELECT coalesce(jsonb_agg(f ORDER BY f.creado_en DESC), '[]'::jsonb) INTO v_filas
  FROM (
    SELECT s.id, s.nombre, s.formato_cva, s.estado, s.codigo_sesion, s.es_personal,
           s.numero_muestras, s.catadores_objetivo, s.creado_en,
           u.nombre AS organizador_nombre, u.email AS organizador_email,
           (SELECT count(*) FROM public.participantes p WHERE p.sesion_id = s.id AND NOT p.es_organizador) AS catadores,
           (SELECT count(*) FROM public.participantes p WHERE p.sesion_id = s.id AND p.listo) AS listos,
           (SELECT count(*) FROM public.evaluaciones e WHERE e.sesion_id = s.id) AS evaluaciones
    FROM public.sesiones s
    LEFT JOIN public.usuarios u ON u.id = s.organizador_id
    WHERE (p_estado IS NULL OR s.estado = p_estado)
      AND (v_filtro IS NULL OR s.nombre ILIKE '%' || v_filtro || '%'
           OR s.codigo_sesion ILIKE '%' || v_filtro || '%'
           OR u.nombre ILIKE '%' || v_filtro || '%')
    ORDER BY s.creado_en DESC
    LIMIT v_limite OFFSET v_desde
  ) f;

  RETURN jsonb_build_object('total', v_total, 'filas', v_filas);
END;
$$;

-- ───────── Auditoría ─────────
CREATE OR REPLACE FUNCTION public.admin_listar_auditoria(
  p_tabla text DEFAULT NULL,
  p_operacion text DEFAULT NULL,
  p_limite integer DEFAULT 50,
  p_desde integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 200);
  v_desde integer := greatest(coalesce(p_desde, 0), 0);
  v_total bigint;
  v_filas jsonb;
BEGIN
  PERFORM public.exigir_admin();

  SELECT count(*) INTO v_total
  FROM public.auditoria_eventos a
  WHERE (p_tabla IS NULL OR a.tabla = p_tabla)
    AND (p_operacion IS NULL OR a.operacion = p_operacion);

  SELECT coalesce(jsonb_agg(f ORDER BY f.creado_en DESC, f.id DESC), '[]'::jsonb) INTO v_filas
  FROM (
    SELECT a.id, a.tabla, a.operacion, a.registro_id, a.sesion_id, a.creado_en,
           s.nombre AS sesion_nombre,
           u.nombre AS actor_nombre, u.email AS actor_email,
           -- Solo metadatos: nunca puntajes ni respuestas de catadores.
           (a.datos - 'puntaje_final' - 'impresion_global' - 'notas') AS datos
    FROM public.auditoria_eventos a
    LEFT JOIN public.sesiones s ON s.id = a.sesion_id
    LEFT JOIN public.usuarios u ON u.id = a.actor_id
    WHERE (p_tabla IS NULL OR a.tabla = p_tabla)
      AND (p_operacion IS NULL OR a.operacion = p_operacion)
    ORDER BY a.creado_en DESC, a.id DESC
    LIMIT v_limite OFFSET v_desde
  ) f;

  RETURN jsonb_build_object('total', v_total, 'filas', v_filas);
END;
$$;

-- Solo usuarios autenticados pueden llamarlas (y luego es_admin() filtra).
REVOKE ALL ON FUNCTION public.exigir_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_resumen() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_listar_usuarios(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cambiar_rol(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_listar_sesiones(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_listar_auditoria(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resumen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listar_usuarios(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_rol(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listar_sesiones(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listar_auditoria(text, text, integer, integer) TO authenticated;
