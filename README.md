# PacamaraQs

**Plataforma web y móvil para sesiones de catación de café y captura de evaluaciones sensoriales.**

[![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![Ionic](https://img.shields.io/badge/Ionic-9-3880FF?logo=ionic&logoColor=white)](https://ionicframework.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%7C%20Auth-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)

## Descripción general

PacamaraQs es una aplicación para apoyar sesiones de catación de café basadas en la metodología **Coffee Value Assessment (CVA)** de la Specialty Coffee Association (SCA). Permite organizar sesiones, recopilar evaluaciones sensoriales y consultar resultados por muestra y formato.

Su objetivo es facilitar el trabajo coordinado de administradores, organizadores y catadores, y ofrecer herramientas digitales para capturar tanto evaluaciones en línea como información extraída de fichas físicas.

## Características principales

### Administrador

- Accede al panel administrativo mediante una cuenta con el rol global `administrador`.
- Las rutas de administración están protegidas por autenticación y validación de rol.

### Organizador

- Crea y coordina sesiones de catación.
- Gestiona el flujo de participantes y el estado de la sesión, incluida la sala de espera.
- Consulta el panel de resultados de las sesiones que organiza.
- Exporta reportes desde la vista de resultados.

> **Nota:** Organizador no es un rol global. La aplicación determina la organización a partir de la relación entre el usuario y la sesión (`sesiones.organizador_id`).

### Catador

- Se registra o inicia sesión y participa en sesiones.
- Completa formularios afectivos, descriptivos, combinados o extrínsecos.
- Puede capturar una evaluación desde una ficha física con el escáner asistido por Gemini, revisar los datos extraídos y guardarlos.
- Los envíos de evaluación utilizan un servicio de sincronización con soporte offline.

### Para todos los usuarios

- **Inicio de sesión** con correo y contraseña o con **Google** (OAuth; en Android vuelve a la app mediante el enlace `com.pacamaraqs.app://auth/callback`). No existe acceso anónimo.
- **Política de tratamiento de datos (Ley 1581 de 2012):** se acepta en el registro o, para quien entra con Google, la primera vez que inicia sesión. Queda registrada la fecha y la versión aceptada.
- **Idiomas:** español, inglés, italiano y chino, con selector en login, registro y dentro de la app.
- **Accesibilidad:** respeta el tamaño de letra del sistema, permite zoom con los dedos, zonas de toque de al menos 44 px y diseño adaptado a pantallas desde 320 px de ancho.

### Reglas de negocio

- Mínimo **3 catadores en estado "listo"** para iniciar una catación.
- **Evaluación ciega:** el catador nunca ve los resultados de otros.
- El formato **Extrínseco** es individual y no pasa por sala de espera.
- El puntaje CVA se calcula en el servidor: `S = 0,65625 × (Σ calidades + impresión global) + 52,75 − 2u − 4d`, redondeado a 0,25.

## Stack tecnológico

| Área | Tecnología | Uso |
| --- | --- | --- |
| Frontend | Angular 22, TypeScript, RxJS | Aplicación web, formularios, navegación y estado de la interfaz. |
| Interfaz y móvil | Ionic 9, Capacitor 8 | Componentes de interfaz y empaquetado para Android. |
| Backend y autenticación | Supabase | Autenticación, acceso a datos y funciones RPC de PostgreSQL. |
| Base de datos | PostgreSQL en Supabase | Usuarios, sesiones, evaluaciones, atributos y resultados. |
| Visión e interpretación de fichas | Gemini Vision (API multimodal) | Analiza una imagen de ficha y devuelve los campos reconocidos en formato JSON. |
| Reportes PDF | HTML/CSS con formato de hoja SCA; `@capgo/capacitor-printer` en Android, iframe de impresión en web | Un mismo reporte para los 4 formatos (Combinado, Afectivo, Descriptivo, Extrínseco); en Android abre el servicio de impresión del sistema, desde donde se guarda como PDF. |
| Exportación de datos | ExcelJS, `@capacitor/filesystem`, `@capacitor/share` | Excel (.xlsx) con hojas Sesión, Resumen, Afectivo, Descriptivo y Datos crudos, o CSV de respaldo. En Android el archivo se comparte con el menú del sistema. |
| Idiomas | Transloco (`@jsverse/transloco`) | Traducciones en `src/assets/i18n/{es,en,it,zh}.json`. |
| Autenticación externa | Supabase Auth + Google OAuth, `@capacitor/browser`, `@capacitor/app` | Inicio de sesión con Google en web y Android. |
| Pruebas y calidad | Vitest, Angular ESLint | Pruebas unitarias y análisis estático. |

## Arquitectura de datos y seguridad

La aplicación utiliza Supabase como cliente de la base de datos. El modelo referenciado por el código incluye:

- `usuarios`: perfil y rol global, como `catador` o `administrador`.
- `sesiones`: formato, participantes, estado y relación con el organizador.
- `evaluaciones`: respuestas y puntajes de cada catador y muestra.
- `evaluacion_atributos`: atributos sensoriales registrados para las evaluaciones.

Las rutas de la aplicación comprueban la autenticación y los roles, pero la protección real está en la base de datos: las tablas tienen RLS activado y las operaciones sensibles pasan por funciones RPC `SECURITY DEFINER` que validan `auth.uid()` (por ejemplo `crear_sesion`, `unirse_sesion`, `marcar_listo`, `iniciar_sesion`, `registrar_evaluacion`, `aceptar_politica`). Un trigger (`trg_validar_estado_sesion`) controla la máquina de estados de la sesión: `esperando → en_progreso` (requiere 3 catadores listos) `→ completada`.

`registrar_evaluacion` guarda la evaluación y sus atributos en **una sola transacción** y calcula el puntaje en el servidor; así se evita que el cierre automático de la sesión deje una ficha sin atributos y que un cliente envíe un puntaje inventado.

El repositorio no contiene el esquema base completo ni todas las políticas RLS; las migraciones de `supabase/migrations/` son incrementales. Antes de anunciar aislamiento garantizado, pruebe con cuentas distintas las lecturas y escrituras permitidas y denegadas.

Las migraciones versionadas en `supabase/migrations/` son incrementales; incluyen cambios en los resultados por formato y funciones RPC como `get_resumen_panel`, así como flujos de sesión personal para fichas escaneadas. `get_resumen_panel` centraliza la lectura agregada del panel de resultados. Las migraciones también definen funciones de servidor como `registrar_ficha_personal` y `unirse_sesion`. Revise cada migración y el esquema base del proyecto antes de aplicarlos: estos archivos no sustituyen una copia completa del esquema ni definen las políticas RLS base.

### Estado de seguridad y publicación

- **Gemini:** el cliente invoca `analizar-ficha`, una Supabase Edge Function que exige un usuario autenticado no anónimo y lee `GEMINI_API_KEY` del entorno del servidor. Reintenta ante errores 503/429 y puede usar un modelo de respaldo (`GEMINI_MODEL_RESPALDO`). La clave nunca va en los archivos `environment` ni en el bundle. Aún falta un límite de escaneos por usuario.
- **Escritura de evaluaciones:** la app ya guarda solo mediante `registrar_evaluacion`. Queda pendiente activar el bloque "PASO 2" de su migración, que retira las políticas de escritura directa, cuando todos usen la versión nueva del APK.
- **Pendientes del asesor de seguridad de Supabase:** desactivar el inicio de sesión anónimo en Auth, activar la protección contra contraseñas filtradas y revocar `EXECUTE` de `rls_auto_enable()` a `anon`/`authenticated`.
- **Android:** `applicationId` es `com.pacamaraqs.app`, pero el `namespace` de Gradle y el paquete de `MainActivity` siguen como `io.ionic.starter`. Para publicar en tiendas conviene alinearlos, poner `allowBackup="false"` y activar `minifyEnabled` en release.

### Arquitectura de reportes

Los cuatro formatos se imprimen con el mismo componente (`ScaReportTemplateComponent`), que reproduce la hoja CVA/SCA de cada formato. En el reporte de panel los descriptores se unen y las notas se agrupan por catador. `ImpresionService` usa la impresión nativa en Android (`@capgo/capacitor-printer`, servicio de impresión del sistema con la opción **Guardar como PDF**) y un `iframe` aislado en web.

Desde Resultados, el menú **Exportar** ofrece PDF o Excel (.xlsx, con CSV como respaldo). En Android los archivos se guardan con `@capacitor/filesystem` y se comparten con `@capacitor/share` (`ArchivosService`). Resultados también muestra gráficas de radar por muestra.

## Estructura del proyecto

```text
PacamaraQs/
├── .github/workflows/               # Compilación automática del APK
├── android/                         # Proyecto nativo de Android (Capacitor)
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── cva/                 # Cálculos CVA/SCA, hoja de reporte y catálogos de origen
│   │   │   ├── export/              # Exportación a Excel (.xlsx)
│   │   │   ├── i18n/                # Idiomas (Transloco) y traductor de textos dinámicos
│   │   │   ├── guards/              # Protección de rutas y roles
│   │   │   ├── mappers/             # Conversión entre modelos y datos
│   │   │   ├── models/              # Tipos y modelos de dominio
│   │   │   ├── scanner/             # Esquemas, saneamiento y lógica del escáner
│   │   │   ├── services/            # Supabase, autenticación, sesiones y resultados
│   │   │   └── utils/               # Funciones auxiliares
│   │   ├── pages/
│   │   │   ├── admin-dashboard/     # Panel administrativo
│   │   │   ├── auth/                # Registro, inicio de sesión y aceptación de la política
│   │   │   ├── dashboard/           # Panel del catador
│   │   │   ├── evaluation/          # Formularios de evaluación
│   │   │   └── session/             # Creación, espera, cierre y resultados
│   │   └── shared/
│   │       └── components/          # Componentes compartidos, incluido el escáner
│   ├── assets/i18n/                 # Traducciones es, en, it, zh
│   └── environments/                # Configuración de desarrollo y producción
├── supabase/
│   ├── functions/                   # Edge Functions, incluida analizar-ficha
│   └── migrations/                  # Migraciones SQL incrementales
├── ios/                             # Proyecto nativo de iOS (Capacitor)
├── capacitor.config.ts              # Configuración de Capacitor
├── ionic.config.json                # Configuración de Ionic
└── package.json                     # Dependencias y comandos del proyecto
```

## Instalación y configuración local

### Requisitos

- Node.js 22 y npm.
- Java 21 y Android SDK (solo para compilar el APK localmente).
- Ionic CLI. Si no está instalado: `npm install -g @ionic/cli`.
- Acceso a un proyecto Supabase configurado con el esquema y las políticas que requiere la aplicación.
- Una clave de Gemini configurada como secreto en Supabase para probar el análisis real. El modo simulado se activa explícitamente mediante `escanerSimulado`; la falta de una clave no activa automáticamente ese modo.

### 1. Clonar e instalar

```bash
git clone <URL_DEL_REPOSITORIO>
cd PacamaraQs
npm install
```

### 2. Configurar los entornos

La aplicación lee su configuración desde `src/environments/environment.ts` y `src/environments/environment.prod.ts`. Define los valores correspondientes en ambos archivos:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://<tu-proyecto>.supabase.co',
  supabaseKey: '<tu-clave-publicable-de-supabase>',
  escanerSimulado: false
};
```

`environment.prod.ts` debe conservar `production: true`. `escanerSimulado: true` devuelve datos de ejemplo y no llama a la IA. La aplicación no consume `geminiApiKey` ni `geminiModel` desde estos archivos.

> **Seguridad de credenciales**
>
> - En el cliente utiliza únicamente la clave publicable de Supabase y protege las tablas con RLS. **Nunca** incluyas una clave `service_role` en `environment.ts` ni en archivos distribuidos al navegador.
> - El escáner ya envía el formato y la imagen a la Edge Function `analizar-ficha`; la función consulta Gemini con el secreto `GEMINI_API_KEY`. No configures una clave de Gemini en el cliente.
> - Configura el secreto y despliega la función para el proyecto Supabase que corresponda:
>
>   ```bash
>   supabase secrets set GEMINI_API_KEY=<tu-clave>
>   supabase functions deploy analizar-ficha
>   ```
>
> - La función exige autenticación, pero el código actual no implementa límites de frecuencia o cuota por usuario. Añádelos y prueba los límites de gasto antes de vender planes de pago.
> - No subas claves privadas al repositorio. Usa valores de prueba o marcadores en los archivos de ejemplo y rota cualquier credencial que se haya expuesto.

Las migraciones de `supabase/migrations/` deben aplicarse en orden. Las más recientes y obligatorias para la versión actual son:

| Migración | Qué agrega |
| --- | --- |
| `20261104150000_resultados_por_formato.sql` | Resultados del panel según el formato. |
| `20261104173000_extrinseco_individual.sql` | Formato Extrínseco individual, sin sala de espera. |
| `20261104213000_resumen_con_formulario.sql` | `get_resumen_panel` con el formulario completo. |
| `20261104230000_sesion_personal_escaneo.sql` | Sesión personal para fichas escaneadas (`registrar_ficha_personal`). |
| `20261109150000_registrar_evaluacion.sql` | Guardado transaccional de evaluaciones con puntaje calculado en el servidor. |
| `20261110150000_aceptar_politica.sql` | Registro de la aceptación de la política de datos. |

### Inicio de sesión con Google

1. En Google Cloud Console, crear un ID de cliente OAuth de tipo **Aplicación web** con el URI de redirección `https://<tu-proyecto>.supabase.co/auth/v1/callback`.
2. En Supabase → Authentication → Providers → Google, pegar el *Client ID* y el *Client Secret*. El secreto **solo** va en Supabase, nunca en la app.
3. En Supabase → Authentication → URL Configuration → Redirect URLs, agregar la URL de la web y `com.pacamaraqs.app://auth/callback` (para Android).

### 3. Iniciar la aplicación

```bash
ionic serve
```

También se puede iniciar el servidor de desarrollo de Angular con:

```bash
npm start
```

## Escáner de fichas físicas e IA

El escáner permite cargar o tomar una fotografía de una ficha física. La aplicación prepara la imagen y la envía, junto con el formato seleccionado, a la Edge Function `analizar-ficha`; esta construye las instrucciones y llama a Gemini Vision. El cliente procesa la respuesta estructurada. Admite fichas combinadas, descriptivas, afectivas y extrínsecas. Antes de guardar, los datos se normalizan y se presentan para revisión; la evaluación no debe considerarse verificada hasta que la persona usuaria confirme la información reconocida.

Si `escanerSimulado` está activado, el servicio devuelve una ficha de ejemplo para probar el flujo de revisión y guardado. Si el modo simulado está desactivado y la función no tiene configurada la clave, el análisis falla con un error de configuración. Aunque la llamada a Gemini ya se realiza en backend, la función todavía requiere controles de uso y gasto antes de ofrecer el escáner en planes de pago.

## Pruebas y compilación

```bash
npm test
npm run lint
npm run build
```

La compilación de Angular genera los archivos web en `www/`. Para sincronizarlos con Android:

```bash
npx cap sync android
npx cap open android
```

### APK automático con GitHub Actions

Cada push ejecuta `.github/workflows/build-android.yml` (Ubuntu 24.04, Node 22, Java 21, Gradle 8.14.3), que compila la web, sincroniza Capacitor y genera un APK de depuración. Se descarga desde la pestaña **Actions** del repositorio, en el artefacto de la ejecución. Si se reinstala sobre una versión anterior y el ícono no cambia, desinstale primero la versión vieja.

### Datos de prueba

La base de datos de desarrollo incluye cuatro sesiones de ejemplo cuyo nombre empieza por `DEMO –` (una por formato). Para eliminarlas antes de producción, borre esas sesiones y sus evaluaciones, participantes y muestras asociadas.

## Contacto

Para consultas sobre el proyecto o sobre el tratamiento de datos personales: **PacamaraQS@gmail.com**.

## Descargo de responsabilidad

PacamaraQs es un software de adaptación e implementación personalizada para este proyecto. **No es un producto oficial, patrocinado ni certificado por la Specialty Coffee Association (SCA).** La referencia a la metodología CVA/SCA describe el marco de evaluación utilizado por la aplicación y no implica afiliación ni respaldo institucional. La terminología, los formularios y los resultados deben validarse frente a las fuentes y versiones oficiales aplicables antes de utilizarlos con fines comerciales, de certificación o de investigación.
