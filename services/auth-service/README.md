# Auth Service – Express + TypeScript + TypeORM

Microservicio encargado de **identidad y autenticación** de la plataforma de
gestión de reparaciones de motores de minería pesada.

- **Stack:** Node.js 20+, Express 5, TypeScript, TypeORM, PostgreSQL, JWT (RS256), bcrypt, Zod, Pino
- **Puerto:** `3001` (configurable)
- **Base de datos:** `auth_db` (PostgreSQL), aislada del resto de microservicios

## Endpoints

Base path: `/api/v1`

### Salud

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | – | Health check del servicio y de la BD |

### Autenticación

| Método | Ruta | Auth | Body / Respuesta |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Público (rate-limited) | `{ email, password }` → `{ data: { accessToken, tokenType, expiresIn, user } }` |
| POST | `/api/v1/auth/register` | **Admin** | Alias de creación de usuario con rol |
| GET | `/api/v1/auth/me` | Bearer | Devuelve el usuario autenticado |

### Usuarios

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/v1/users` | Admin | Lista paginada (`?page=&limit=&search=&role=&isActive=`) |
| POST | `/api/v1/users` | Admin | Crea usuario (`email`, `password`, `firstName`, `lastName`, `role`) |
| GET | `/api/v1/users/:id` | Admin | Consulta usuario |
| PATCH | `/api/v1/users/:id` | Admin | Actualiza usuario (rol, isActive, email, nombres) |
| DELETE | `/api/v1/users/:id` | Admin | Desactiva usuario (soft delete) |
| GET | `/api/v1/users/me` | Autenticado | Consulta propio perfil |
| PATCH | `/api/v1/users/me` | Autenticado | Actualiza propio perfil |
| POST | `/api/v1/users/me/change-password` | Autenticado | Cambia propio password |

Errores estándar: `{ error: { code, message, details?, requestId } }`

## Flujo de autenticación

1. `POST /api/v1/auth/login` con `{ email, password }`.
2. El servicio valida con **bcrypt** y emite un JWT firmado con **RS256**
   (private key) con `sub`, `email`, `role`, `type: "access"`, `iss`, `aud`, `exp`.
3. El cliente envía `Authorization: Bearer <token>`.
4. `authenticate` verifica firma/expiración/issuer/audience **y** vuelve a leer el
   usuario en la base de datos para descartar tokens de cuentas desactivadas.

### JWT

- Algoritmo: **RS256** (asimétrico).
- Firma: solo el auth-service con la private key (`keys/jwt-private.pem`).
- Validación: el auth-service (y el servicio de reparaciones) con la public key
  (`keys/jwt-public.pem`). Los claims mínimo son `sub` (id usuario) y `role`.
- Expiración: 1 h (`JWT_EXPIRES_IN_SECONDS`).

Generar llaves:

```bash
npm run keys:generate        # crea keys/jwt-private.pem y keys/jwt-public.pem
```

## Ejecución local

```bash
cp .env.example .env          # ajustar credenciales de BD
docker compose up -d          # postgres + pgadmin (desde la raíz del repo)
npm install
npm run migration:run        # crea el schema en auth_db
npm run dev                   # servidor en http://localhost:3001
```

Bootstrap del primer admin (idempotente, se ejecuta si no existe ningún admin):

```bash
npm run seed
```

## Tests

```bash
npm test        # vitest (unit + integration contra auth_db_test)
```

## Docker

```bash
docker build -t mer-auth-service .
docker run --rm -p 3001:3001 --env-file .env -v $(pwd)/../../keys:/app/keys ...
```
