# Frontend – React + TypeScript + Vite

Interfaz web de la plataforma. Hace login contra el **auth-service** y usa el
JWT que recibe para consumir el **repairs-service**.

- **Stack:** React 19, TypeScript, Vite, React Router, TanStack Query,
  react-hook-form + Zod, Tailwind CSS, Vitest + Testing Library
- **Puerto:** `5173`

## Pantallas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/login` | Inicio de sesión | Público |
| `/` | Dashboard: órdenes por estado y órdenes recientes | Autenticado |
| `/orders` | Órdenes con búsqueda y filtros por estado, cliente y motor | Autenticado |
| `/orders/new` | Crear orden | Autenticado |
| `/orders/:id` | Detalle: datos, progreso, historial y cambio de estado | Autenticado |
| `/clients`, `/clients/:id` | Listado, creación, edición y consulta de clientes | Autenticado (activar/desactivar: admin) |
| `/engines`, `/engines/:id` | Listado, creación, edición y consulta de motores | Autenticado (activar/desactivar: admin) |
| `/users` | Administración de usuarios | Solo admin |

## Estructura

```
src/
├── api/          Cliente HTTP (token, errores), endpoints de ambas APIs y tipos
├── auth/         Sesión (sessionStorage), AuthProvider, guards de rutas
├── components/   UI reutilizable (botones, formularios, tablas, modal, toasts) y layout
├── lib/          Formatos de fecha, etiquetas en español, utilidades
├── pages/        Una carpeta por módulo: clients, engines, orders, users
├── router.tsx    Rutas (cada página se carga bajo demanda)
└── main.tsx      Providers: React Query, toasts, auth y router
```

## Cómo maneja la sesión

1. `LoginPage` llama a `POST {auth}/auth/login` y guarda `{ token, user, expiresAt }`
   en `sessionStorage` (se pierde al cerrar la pestaña).
2. `api/http.ts` agrega `Authorization: Bearer <token>` a cada petición, tanto al
   auth-service como al repairs-service.
3. Si cualquier API responde **401** (token vencido o inválido), se cierra la
   sesión y se vuelve al login con el mensaje "Tu sesión expiró". La sesión
   también se cierra sola en el momento exacto en que vence el token.
4. `RequireAuth` protege las rutas privadas y `RequireAdmin` la de usuarios. Es
   solo una ayuda visual: quien de verdad valida permisos son las APIs.

## Errores y confirmaciones

- Las APIs responden `{ error: { code, message } }`. `api/errors.ts` traduce
  esos errores a mensajes en español (p. ej. un 409 por número de serie
  duplicado → "Ya existe un motor con ese número de serie.").
- Los formularios validan en el navegador con las mismas reglas que las APIs, y
  los errores del servidor se muestran arriba del formulario.
- Las acciones exitosas muestran un aviso de confirmación (toast).

## Configuración

| Variable | Por defecto | Descripción |
|---|---|---|
| `VITE_AUTH_API_URL` | `http://localhost:3001/api/v1` | URL del auth-service, vista desde el navegador |
| `VITE_REPAIRS_API_URL` | `http://localhost:8000/api/v1` | URL del repairs-service, vista desde el navegador |

Vite fija estas variables al compilar. En Docker se pasan como `build args`
(ver `docker-compose.yml`). El origen del front debe estar en `CORS_ORIGINS` de
ambas APIs (por defecto `http://localhost:5173`).

## Ejecución

```bash
npm install
cp .env.example .env     # opcional, solo si cambias las URLs
npm run dev              # http://localhost:5173 (las APIs deben estar corriendo)
```

Con Docker, desde la raíz: `docker compose up -d --build frontend` (se sirve con nginx).

## Calidad

```bash
npm run lint        # oxlint
npm run typecheck   # tsc
npm test            # vitest
npm run build
```
