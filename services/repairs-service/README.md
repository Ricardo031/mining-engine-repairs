# Repairs Service – FastAPI + SQLAlchemy + PostgreSQL

Microservicio de **negocio**: clientes, motores de minería pesada y órdenes de
reparación con su historial de estados.

- **Stack:** Python 3.12+, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, PyJWT (RS256), Pydantic
- **Puerto:** `8000`
- **Base de datos:** `repairs_db`, propia de este servicio
- **Documentación OpenAPI:** http://localhost:8000/docs (Swagger) y `/redoc`

No guarda contraseñas ni tiene login propio: solo **valida** los JWT emitidos por
el auth-service.

## Arquitectura interna

```
app/
├── routers/       HTTP: parámetros, dependencias y modelos de respuesta
├── services/      Lógica de negocio y reglas (duplicados, flujo de estados...)
├── repositories/  Acceso a datos (único lugar con consultas SQL)
├── models/        Tablas SQLAlchemy
├── schemas/       Validación de entrada/salida (Pydantic)
├── core/          Errores comunes y flujo de estados de la orden
├── security.py    Validación del JWT y control de roles
└── main.py        Creación de la app, CORS, request id, manejadores de error
alembic/           Migraciones de la base de datos
tests/             Pruebas (pytest) contra repairs_db_test
```

## Autenticación

1. El frontend hace login en el auth-service (`POST :3001/api/v1/auth/login`).
2. Envía el token a este servicio: `Authorization: Bearer <token>`.
3. [security.py](app/security.py) verifica con la **clave pública** RSA:
   firma (solo `RS256`), expiración (`exp`), emisor (`iss`), audiencia (`aud`),
   claims obligatorios (`sub`, `iat`), `type == "access"` y un rol válido.
4. Cualquier fallo devuelve `401` (`INVALID_TOKEN` o `TOKEN_EXPIRED`); un rol
   insuficiente devuelve `403`.

El servicio solo tiene la clave pública, así que puede validar tokens pero nunca
crearlos.

| Rol | Permisos |
|---|---|
| `operator` | Crear, consultar y editar clientes y motores; crear órdenes y cambiar su estado |
| `admin` | Todo lo anterior y desactivar clientes y motores |

## Endpoints

Base: `/api/v1`. Todos requieren token, menos `/health`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio y de la base de datos (público) |
| GET | `/auth/me` | Identidad leída del token |
| POST | `/clients` | Crear cliente |
| GET | `/clients` | Listar (`?search=&is_active=&page=&limit=`) |
| GET | `/clients/{id}` | Consultar cliente |
| PATCH | `/clients/{id}` | Editar cliente |
| DELETE | `/clients/{id}` | Desactivar cliente (admin, borrado lógico) |
| POST | `/engines` | Crear motor |
| GET | `/engines` | Listar (`?search=&client_id=&is_active=&page=&limit=`) |
| GET | `/engines/{id}` | Consultar motor |
| PATCH | `/engines/{id}` | Editar motor |
| DELETE | `/engines/{id}` | Desactivar motor (admin, borrado lógico) |
| POST | `/orders` | Crear orden (queda en `RECEIVED`) |
| GET | `/orders` | Listar (`?status=&client_id=&engine_id=&search=&page=&limit=`) |
| GET | `/orders/summary` | Cantidad de órdenes por estado (dashboard) |
| GET | `/orders/{id}` | Detalle de la orden con su historial |
| GET | `/orders/by-number/{order_number}` | Buscar por número de orden (`OR-2026-000001`) |
| PATCH | `/orders/{id}/status` | Cambiar estado (`{ status, note?, actual_delivery_date? }`) |

Formato de respuestas: `{ "data": ... }`. Los listados agregan
`"meta": { page, limit, total, total_pages }`.

Formato de errores, igual que el auth-service:
`{ "error": { "code", "message", "details"?, "requestId" } }`

| Código HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Datos inválidos o campos no permitidos |
| 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | Token ausente o inválido |
| 403 | `FORBIDDEN` | Rol insuficiente |
| 404 | `NOT_FOUND` | El recurso no existe |
| 409 | `CONFLICT` | Identificación de cliente o serie de motor duplicada |
| 422 | `BUSINESS_RULE_VIOLATION` | Cambio de estado inválido, motor o cliente inactivo, motor con orden abierta |

## Reglas de negocio

- **Sin duplicados:** el número de identificación del cliente y el número de
  serie del motor son únicos (sin importar mayúsculas). Hay un índice único en
  la base de datos como respaldo.
- **Número de orden** `OR-<año>-<consecutivo>`: lo genera el servidor a partir
  de una secuencia de PostgreSQL.
- **Cliente de la orden:** se toma del motor; no se envía en la petición.
- **Una orden abierta por motor:** no se puede crear otra hasta que la anterior
  esté `DELIVERED`.
- **Solo clientes y motores activos** pueden recibir motores u órdenes nuevas.
- **Flujo de estados** ([workflow.py](app/core/workflow.py)):

```
RECEIVED → IN_DIAGNOSIS → AWAITING_APPROVAL → IN_REPAIR → IN_TESTING → COMPLETED → DELIVERED
                ↑                 │                ↑            │
                └─────────────────┘                └────────────┘
         (presupuesto rechazado)                  (falla en pruebas)
```

  Cada cambio guarda una fila en `order_status_history` con el estado anterior,
  el nuevo, una nota y quién lo hizo (id y email tomados del token). Al pasar a
  `DELIVERED` se registra la fecha real de entrega.

## Modelo de datos

```
clients 1───* engines 1───* repair_orders 1───* order_status_history
   └──────────────────────────────┘ (client_id: dueño al recibir el motor)
```

Los usuarios viven en `auth_db`. Aquí solo se guarda su id y email como texto
(`created_by`, `changed_by`), sin llave foránea, así que ningún servicio lee las
tablas del otro.

## Ejecución local

Requisito: Postgres levantado con `docker compose up -d postgres` desde la raíz
y las llaves generadas en `keys/` (`npm run keys:generate` en el auth-service).

```bash
python -m venv .venv
.venv\Scripts\activate             # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head               # crea las tablas en repairs_db
uvicorn app.main:app --reload --port 8000
```

Con Docker, desde la raíz: `docker compose up -d --build repairs-service`. El
contenedor aplica las migraciones antes de arrancar.

## Tests y calidad

```bash
pytest                    # usa repairs_db_test (se reconstruye con las migraciones)
pytest --cov=app          # con cobertura
ruff check . && ruff format --check .
```

Los tests generan su propio par de llaves RSA y firman tokens igual que el
auth-service. Así comprueban que se rechazan firmas de otra llave, tokens
expirados, payload modificado, `alg: none`, HS256 con la llave pública,
y `iss`/`aud`/`type`/`role` inválidos.
