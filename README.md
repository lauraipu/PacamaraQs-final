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
| Reportes PDF | HTML/CSS, iframe aislado y API de impresión del navegador | Compone el reporte y permite imprimirlo o guardarlo como PDF desde el dispositivo. |
| Pruebas y calidad | Vitest, Angular ESLint | Pruebas unitarias y análisis estático. |

## Arquitectura de datos y seguridad

La aplicación utiliza Supabase como cliente de la base de datos. El modelo referenciado por el código incluye:

- `usuarios`: perfil y rol global, como `catador` o `administrador`.
- `sesiones`: formato, participantes, estado y relación con el organizador.
- `evaluaciones`: respuestas y puntajes de cada catador y muestra.
- `evaluacion_atributos`: atributos sensoriales registrados para las evaluaciones.

Las rutas de la aplicación comprueban la autenticación y los roles, mientras que **Row Level Security (RLS)** debe proteger también el acceso a los datos en PostgreSQL. La autorización del cliente no sustituye a RLS: configure y verifique las políticas en el proyecto Supabase para que cada usuario solo pueda realizar las operaciones permitidas por su rol y participación en la sesión.

Las migraciones versionadas en `supabase/migrations/` son incrementales; incluyen cambios en los resultados por formato y funciones RPC como `get_resumen_panel`, así como flujos de sesión personal para fichas escaneadas. `get_resumen_panel` centraliza la lectura agregada del panel de resultados. Las migraciones también definen funciones de servidor como `registrar_ficha_personal` y `unirse_sesion`. Revise cada migración y el esquema base del proyecto antes de aplicarlos: estos archivos no sustituyen una copia completa del esquema y las políticas RLS existentes.

### Arquitectura de reportes

Los reportes se componen en HTML con estilos de impresión y se abren en un `iframe` aislado. Desde ahí se invoca el diálogo de impresión del navegador o sistema operativo, donde el usuario puede elegir **Guardar como PDF**. Los formatos combinado y descriptivo incluyen una presentación basada en la hoja CVA/SCA correspondiente. La generación del PDF ocurre en el dispositivo; no depende de un servicio de renderizado PDF en el backend.

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
│   └── migrations/                  # Migraciones SQL incrementales
├── capacitor.config.ts              # Configuración de Capacitor
├── ionic.config.json                # Configuración de Ionic
└── package.json                     # Dependencias y comandos del proyecto
```

## Instalación y configuración local

### Requisitos

- Node.js y npm en versiones compatibles con Angular 22.
- Ionic CLI. Si no está instalado: `npm install -g @ionic/cli`.
- Acceso a un proyecto Supabase configurado con el esquema y las políticas que requiere la aplicación.
- Una clave de Gemini para probar el análisis real de imágenes. Sin una clave configurada, el escáner puede utilizar su modo simulado.

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
  geminiApiKey: '<tu-GEMINI_API_KEY>',
  geminiModel: '<modelo-gemini-compatible>'
};
```

El ejemplo muestra los nombres de propiedades que consume actualmente el código; reemplaza los valores de ejemplo y conserva la configuración de producción apropiada en `environment.prod.ts`.

> **Seguridad de credenciales**
>
> - En el cliente utiliza únicamente la clave publicable de Supabase y protege las tablas con RLS. **Nunca** incluyas una clave `service_role` en `environment.ts` ni en archivos distribuidos al navegador.
> - El escáner actual llama a Gemini directamente desde el cliente. Una `geminiApiKey` real incluida en un `environment.ts` queda expuesta en el bundle de la aplicación: limita este uso a desarrollo y no publiques esa clave.
> - Para producción, almacena `GEMINI_API_KEY` como secreto de una **Supabase Edge Function** autenticada y envía el análisis a través de esa función. Los secretos de Supabase no son leídos directamente por la aplicación web; configurarlos por sí solos requiere implementar y desplegar esa función. No hay que confundir los secretos del backend con la clave publicable de Supabase que utiliza el cliente.
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

El escáner permite cargar o tomar una fotografía de una ficha física. La aplicación prepara la imagen, la envía a Gemini Vision con instrucciones específicas para el formato seleccionado y procesa la respuesta estructurada. Admite fichas combinadas, descriptivas, afectivas y extrínsecas. Antes de guardar, los datos se normalizan y se presentan para revisión; la evaluación no debe considerarse verificada hasta que la persona usuaria confirme la información reconocida.

Si no hay una clave real de Gemini configurada, el servicio puede devolver una ficha de ejemplo en modo simulado para probar el flujo de revisión y guardado. Para proteger la cuota y la clave, las versiones publicadas deben realizar la llamada a la IA desde una función backend autenticada, no desde el navegador.

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
