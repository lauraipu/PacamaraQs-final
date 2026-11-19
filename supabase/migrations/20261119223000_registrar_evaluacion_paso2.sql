-- PASO 2 de la migración registrar_evaluacion (2026-11-09): cerrar la puerta de
-- atrás. Las fichas solo se guardan con registrar_evaluacion / registrar_ficha_personal
-- (SECURITY DEFINER), que validan y recalculan el puntaje CVA en el servidor.
-- Sin estas políticas nadie puede escribir puntaje_final directo por la API.
-- La lectura (evaluaciones_select_propias, atributos_select_propios) no cambia.
-- Aplicada en Supabase el 2026-11-19. Efecto: un APK anterior al 2026-11-09 ya no puede guardar fichas.
DROP POLICY IF EXISTS evaluaciones_insert_participante ON public.evaluaciones;
DROP POLICY IF EXISTS evaluaciones_update_participante ON public.evaluaciones;
DROP POLICY IF EXISTS atributos_write_propios ON public.evaluacion_atributos;

-- Para revertir (solo si hiciera falta):
-- CREATE POLICY evaluaciones_insert_participante ON public.evaluaciones FOR INSERT TO authenticated
--   WITH CHECK ((catador_id = auth.uid()) AND public.puede_evaluar(sesion_id, numero_muestra));
-- CREATE POLICY evaluaciones_update_participante ON public.evaluaciones FOR UPDATE TO authenticated
--   USING ((catador_id = auth.uid()) AND public.puede_evaluar(sesion_id, numero_muestra))
--   WITH CHECK ((catador_id = auth.uid()) AND public.puede_evaluar(sesion_id, numero_muestra));
-- CREATE POLICY atributos_write_propios ON public.evaluacion_atributos FOR ALL TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.evaluaciones e WHERE e.id = evaluacion_atributos.evaluacion_id
--          AND e.catador_id = auth.uid() AND public.puede_evaluar(e.sesion_id, e.numero_muestra)))
--   WITH CHECK (EXISTS (SELECT 1 FROM public.evaluaciones e WHERE e.id = evaluacion_atributos.evaluacion_id
--          AND e.catador_id = auth.uid() AND public.puede_evaluar(e.sesion_id, e.numero_muestra)));
