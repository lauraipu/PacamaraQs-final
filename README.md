# Pacamara QS

Aplicación web y móvil para organizar sesiones de evaluación sensorial, registrar evaluaciones y consultar sus resultados. Está construida con Angular, Ionic y Capacitor, y utiliza Supabase para autenticación, datos y funciones en tiempo real.

## Funcionalidades

- Registro e inicio de sesión.
- Panel de catadores y panel administrativo con control de acceso por rol.
- Creación y coordinación de sesiones, incluida una sala de espera para participantes.
- Formularios de evaluación afectiva, descriptiva, combinada y extrínseca.
- Consulta de resultados de sesión y flujo para completar evaluaciones.
- Sincronización de datos y actualizaciones en tiempo real mediante servicios de la aplicación.

## Tecnologías

- Angular 22 e Ionic 9.
- TypeScript y RxJS.
- Supabase (`@supabase/supabase-js`).
- Capacitor 8 para la aplicación Android.
- Vitest para pruebas y Angular ESLint para análisis estático.

## Requisitos

- Node.js y npm en versiones compatibles con Angular 22.
- Acceso a un proyecto Supabase configurado para la aplicación.
- Android Studio y el SDK de Android si se desea ejecutar o compilar la versión nativa.

## Instalación y desarrollo

```bash
npm install
npm start
```

El servidor de desarrollo de Angular estará disponible en `http://localhost:4200/`.

## Configuración de Supabase

La aplicación obtiene la URL y la clave publicable de Supabase desde:

- `src/environments/environment.ts` para desarrollo.
- `src/environments/environment.prod.ts` para compilaciones de producción.

Configura `supabaseUrl` y `supabaseKey` con los valores del proyecto Supabase que corresponda antes de ejecutar o desplegar la aplicación. La clave utilizada en el cliente debe ser una clave publicable; nunca incluyas una clave `service_role` ni otros secretos en el código del cliente.

Las migraciones SQL de Supabase se encuentran en `supabase/migrations/`. Revisa y aplica las migraciones necesarias en el proyecto Supabase antes de publicar cambios que dependan de ellas.

## Comandos disponibles

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia el servidor de desarrollo. |
| `npm run build` | Compila la aplicación para producción en `www/`. |
| `npm run watch` | Compila en modo desarrollo y vuelve a compilar al detectar cambios. |
| `npm test` | Ejecuta las pruebas unitarias. |
| `npm run lint` | Analiza el código TypeScript y las plantillas HTML. |

## Android

Después de compilar la aplicación web, sincroniza los archivos con el proyecto nativo:

```bash
npm run build
npx cap sync android
npx cap open android
```

Esto abre el proyecto Android en Android Studio, donde se puede ejecutar o generar el paquete de la aplicación.

## Estructura principal

```text
src/
  app/
    core/       Servicios, guards, modelos, utilidades y mapeadores
    pages/      Vistas de autenticación, paneles, sesiones y evaluaciones
  environments/ Configuración de Supabase para desarrollo y producción
supabase/
  migrations/   Migraciones SQL
```
