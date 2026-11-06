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

## Stack tecnológico

| Área | Tecnología | Uso |
| --- | --- | --- |
| Frontend | Angular 22, TypeScript, RxJS | Aplicación web, formularios, navegación y estado de la interfaz. |
| Interfaz y móvil | Ionic 9, Capacitor 8 | Componentes de interfaz y empaquetado para Android. |
| Backend y autenticación | Supabase | Autenticación, acceso a datos y funciones RPC de PostgreSQL. |
| Base de datos | PostgreSQL en Supabase | Usuarios, sesiones, evaluaciones, atributos y resultados. |
| Visión e interpretación de fichas | Gemini Vision (API multimodal) | Analiza una imagen de ficha y devuelve los campos reconocidos en formato JSON. |
| Reportes PDF | HTML/CSS, iframe aislado y API de impresión del navegador | Compone el reporte e invoca el diálogo de impresión. La descarga y el compartir PDF nativos en Android aún no están implementados. |
| Pruebas y calidad | Vitest, Angular ESLint | Pruebas unitarias y análisis estático. |

## Arquitectura de datos y seguridad

La aplicación utiliza Supabase como cliente de la base de datos. El modelo referenciado por el código incluye:

- `usuarios`: perfil y rol global, como `catador` o `administrador`.
- `sesiones`: formato, participantes, estado y relación con el organizador.
- `evaluaciones`: respuestas y puntajes de cada catador y muestra.
- `evaluacion_atributos`: atributos sensoriales registrados para las evaluaciones.

Las rutas de la aplicación comprueban la autenticación y los roles, pero esa autorización del cliente no protege la base de datos. El repositorio no contiene el esquema base completo ni las políticas RLS de las tablas; por tanto, **no permite confirmar que el proyecto Supabase desplegado impida el acceso cruzado a los datos**. No anuncie privacidad o aislamiento garantizados hasta auditar las políticas efectivas en Supabase y probar, con cuentas y roles distintos, lecturas y escrituras permitidas y denegadas.

Las migraciones versionadas en `supabase/migrations/` son incrementales; incluyen cambios en los resultados por formato y funciones RPC como `get_resumen_panel`, así como flujos de sesión personal para fichas escaneadas. `get_resumen_panel` centraliza la lectura agregada del panel de resultados. Las migraciones también definen funciones de servidor como `registrar_ficha_personal` y `unirse_sesion`. Revise cada migración y el esquema base del proyecto antes de aplicarlos: estos archivos no sustituyen una copia completa del esquema ni definen las políticas RLS base.

### Estado de seguridad y publicación

- **Gemini:** el cliente invoca `analizar-ficha`, una Supabase Edge Function que exige un usuario autenticado no anónimo y lee `GEMINI_API_KEY` del entorno del servidor. La clave no debe incluirse en los archivos `environment` ni en el bundle. La autenticación por sí sola no limita el gasto: antes de ofrecer planes de pago, establezca límites de uso por usuario, monitorización y alertas de cuota/coste.
- **RLS:** pendiente de verificación contra el proyecto Supabase real. Las comprobaciones de roles del frontend y las funciones RPC no sustituyen políticas RLS correctas.
- **Android:** `capacitor.config.ts` y `applicationId` usan `com.pacamaraqs.app`, pero el `namespace` de Gradle y el paquete de `MainActivity` todavía usan `io.ionic.starter`. Revise y alinee estos identificadores antes de distribuir la aplicación.
- **PDF en Android:** la implementación actual abre el diálogo de impresión del navegador. No crea un archivo PDF mediante `@capacitor/filesystem` ni lo comparte mediante `@capacitor/share`; el flujo de descarga/compartición nativa sigue pendiente.

### Arquitectura de reportes

Los reportes se componen en HTML con estilos de impresión y se abren en un `iframe` aislado. Desde ahí se invoca el diálogo de impresión del navegador o sistema operativo, donde el usuario puede elegir **Guardar como PDF** si el dispositivo ofrece esa opción. Los formatos combinado y descriptivo incluyen una presentación basada en la hoja CVA/SCA correspondiente. Esta implementación no genera un archivo PDF compartible mediante las APIs nativas de Capacitor; en particular, el flujo requerido para guardar y compartir el PDF desde Android todavía debe implementarse.

## Estructura del proyecto

```text
PacamaraQs/
├── android/                         # Proyecto nativo de Android (Capacitor)
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── cva/                 # Cálculos y representación CVA/SCA
│   │   │   ├── guards/              # Protección de rutas y roles
│   │   │   ├── mappers/             # Conversión entre modelos y datos
│   │   │   ├── models/              # Tipos y modelos de dominio
│   │   │   ├── scanner/             # Esquemas, saneamiento y lógica del escáner
│   │   │   ├── services/            # Supabase, autenticación, sesiones y resultados
│   │   │   └── utils/               # Funciones auxiliares
│   │   ├── pages/
│   │   │   ├── admin-dashboard/     # Panel administrativo
│   │   │   ├── auth/                # Registro e inicio de sesión
│   │   │   ├── dashboard/           # Panel del catador
│   │   │   ├── evaluation/          # Formularios de evaluación
│   │   │   └── session/             # Creación, espera, cierre y resultados
│   │   └── shared/
│   │       └── components/          # Componentes compartidos, incluido el escáner
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

- Node.js y npm en versiones compatibles con Angular 22.
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

Las migraciones de `supabase/migrations/` deben revisarse y aplicarse en el orden previsto sobre el proyecto Supabase antes de utilizar las funciones correspondientes.

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

## Descargo de responsabilidad

PacamaraQs es un software de adaptación e implementación personalizada para este proyecto. **No es un producto oficial, patrocinado ni certificado por la Specialty Coffee Association (SCA).** La referencia a la metodología CVA/SCA describe el marco de evaluación utilizado por la aplicación y no implica afiliación ni respaldo institucional. La terminología, los formularios y los resultados deben validarse frente a las fuentes y versiones oficiales aplicables antes de utilizarlos con fines comerciales, de certificación o de investigación.
