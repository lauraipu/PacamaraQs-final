# PacamaraQS — contexto para Claude Code

App de evaluación sensorial de café Pacamara con la metodología SCA CVA.
Angular 22 (standalone, **zoneless**), Ionic 9, Capacitor 8 (APK Android), Supabase
(proyecto `pjcvoqnsrifdvvuxaweb`), Transloco (es/en/it/zh). Web en Vercel:
https://pacamara-qs-final.vercel.app — repo `lauraipu/PacamaraQs-final`, rama **master** (única rama de trabajo).

## Reglas de negocio (no negociables)
- No hay acceso anónimo: todo usuario está autenticado.
- Mínimo 3 catadores en estado "listo" para iniciar una catación.
- Evaluación ciega: un catador nunca ve resultados de otros.
- El formato Extrínseco es individual y no usa sala de espera.
- Administrador = `rol_global = 'administrador'` + verificación en dos pasos (aal2). Las RPC `admin_*` lo validan en el servidor con `es_admin()`.

## Arquitectura (Fase 2, en curso)
```
src/app/
  app.routes.ts      solo compone features con loadChildren (las URL NO cambian)
  core/              singletons: supabase/, auth/ (+guards/, roles.ts, dos-pasos), errores/, i18n/, guias/,
                     plataforma/, realtime/ (sala en vivo), data-access/ (sesiones, cola offline de evaluaciones)
  domain/            TypeScript puro (reglas CVA/SCA, catálogos, ficha técnica). Sin Angular ni Supabase.
  shared/            UI pura (components/), pipes/ (respaldo), utils/ (formato, lista-paginada, pagina)
  features/<x>/      auth, perfil, sesiones (+escaner/), evaluacion, resultados, admin
                     cada una: <x>.routes.ts, pages/, y si aplica data-access/ (dto, mapper, repository), models/, ui/
```
Fronteras (las hace cumplir ESLint `no-restricted-imports` en `eslint.config.js`):
- `domain/` no importa nada externo ni otra capa.
- `core/` no importa `shared/` ni `features/`.
- `shared/` no importa `features/`, repositorios ni el cliente de Supabase.
- Una feature no importa archivos internos de otra (lo compartido entre features va a `core/data-access/` o `domain/`).
- Alias: `@core/*`, `@domain/*`, `@shared/*`, `@features/*`.
- Mappers = traductores puros DTO → modelo (sin reglas de negocio, sin textos de pantalla).
- Componentes nunca llaman a Supabase: siempre vía repositorio.

## Estado del refactor de 12 pasos (documento: https://claude.ai/artifact/H7RavfZ2phL2GU2QyURBuR)
- Fase 2 terminada (19-nov-2026): los 12 pasos con commit en master; build, 145 tests y ESLint en verde;
  prueba manual completa hecha. Detalle por paso y hallazgos en la sección "Estado de ejecución" del documento.
- Paso 12 corrigió: ruta de `combined-form` en `src/global.scss` (build roto desde el paso 8) y doble
  global de `ModalController` en `src/test-setup.ts` (52 tests que fallaban desde antes de la Fase 2);
  borró los pipes sin uso `fecha`, `precio`, `siNo`, `megabytes` y las claves `comun.si`/`comun.no`.
- Pendiente fuera de la fase: presupuesto de `results.page.scss` (15,9 kB de 8 kB) y los pendientes de seguridad.

Desvíos del plan ya decididos (no revertir):
- Repositorio de sesiones, tiempo real y cola offline van en `core/` (los usan varias features).
- El escáner vive en `features/sesiones/escaner/` (solo lo abre el inicio).
- `gustos-predominantes` se queda en `shared/` (lo usan los formularios).
- Guías: su persistencia está en `core/guias/guias.repository.ts`; el modal se inyecta con el token
  `CARGAR_MODAL_GUIA` (lo provee `main.ts`) para que `core/` no importe `shared/`.
- Ficha técnica: regla en `domain/ficha-tecnica/`, presentación en `features/resultados/presentacion/`;
  las etiquetas siguen en español porque ya se traducen con `tr()`.

## Protocolo de trabajo (pedido por la dueña del proyecto)
- Un paso a la vez; parar al terminar cada paso para revisión. Commits atómicos, `git mv` al mover archivos.
- `npm run build` y `npm test` deben pasar antes de cada commit.
- Cero cambios visuales o funcionales en refactors: no tocar SCSS, clases de Ionic, textos visibles ni URLs.
- Respuestas concisas, en español. Sin emojis. Mantener el tema visual de la app (fondo gris claro, tarjetas blancas).

## Detalles técnicos que causan bugs si se olvidan
- **Zoneless**: valores asignados después de un `await` deben ser signals (o llamar `markForCheck`).
- **Ionic cachea páginas**: `ngOnInit` no se repite al volver; usar `ionViewWillEnter`. Antes de navegar,
  `(document.activeElement as HTMLElement)?.blur()` (Ionic pone `aria-hidden` en la página que sale).
- Componentes abiertos con `ModalController` (`componentProps`): usar `@Input()` setter, no `input()` signal.
- Íconos: registrar cada uno con `addIcons` de `ionicons/icons`.
- Recuperación de contraseña usa flujo implícito (`type=recovery` en el hash); no activar PKCE sin revisar eso.
- Windows: el repo usa CRLF en la copia de trabajo (`core.autocrlf=true`).

## Seguridad
- Nunca escribir ni mostrar claves (Gemini, OAuth de Google, contraseña de aplicación de Gmail): viven solo en Supabase.
- Cambios de base de datos: migración en `supabase/migrations/` + políticas RLS / `SECURITY DEFINER` con `es_admin()` o `es_usuario_real()`.
- Pendientes de seguridad conocidos: activar "leaked password protection" en Supabase Auth; revocar
  `EXECUTE` de `rls_auto_enable()` para `anon`/`authenticated`; considerar repo privado.

## Comandos
```
npm run build     # ng build
npm test          # ng test (vitest)
npm run lint      # ESLint (fronteras incluidas)
ionic serve       # http://localhost:8100
```
