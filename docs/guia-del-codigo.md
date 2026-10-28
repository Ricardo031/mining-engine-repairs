# Guía del código: qué hace cada cosa y cómo se conecta

Esta guía es para entender el proyecto de principio a fin y poder explicarlo en
la sustentación. Va de lo general a lo particular. Lee las secciones en orden
la primera vez.

---

## 1. La idea en 30 segundos

Hay **dos APIs** que no comparten base de datos ni código:

- **auth-service (Express):** sabe *quién eres*. Guarda usuarios y contraseñas,
  y cuando haces login te entrega un **token JWT**.
- **repairs-service (FastAPI):** sabe *del negocio* (clientes, motores, órdenes).
  No sabe de contraseñas. Solo revisa que el token que le mandas sea auténtico.

¿Cómo sabe FastAPI que el token es auténtico sin preguntarle a Express? Con
**criptografía asimétrica (RS256)**:

- Express tiene una **llave privada** (`keys/jwt-private.pem`) y con ella *firma* el token.
- FastAPI tiene solo la **llave pública** (`keys/jwt-public.pem`) y con ella *verifica* la firma.

Piensa en un sello de lacre: solo Express tiene el sello (llave privada), pero
cualquiera que tenga la foto del sello (llave pública) puede comprobar que es
original. Con la foto no se puede fabricar un sello nuevo, así que FastAPI
puede validar tokens pero **nunca crearlos**.

```
 Frontend ──(email+password)──► auth-service ──► auth_db (usuarios)
    ▲                               │
    └──────── token JWT ────────────┘  (firmado con la llave PRIVADA)

 Frontend ──(Authorization: Bearer <token>)──► repairs-service ──► repairs_db
                                                  │
                                    verifica con la llave PÚBLICA
```

---

## 2. Infraestructura (raíz del repo)

| Archivo | Qué hace |
|---|---|
| [docker-compose.yml](../docker-compose.yml) | Define los contenedores: `postgres`, `pgadmin`, `auth-service`, `repairs-service`. Cada servicio recibe sus variables de entorno y su llave. Fíjate en los `volumes`: al auth-service se le monta la carpeta `keys/` completa y al repairs-service **solo** `jwt-public.pem`. |
| [.env.example](../.env.example) | Plantilla de variables para docker compose. Se copia a `.env` (que git ignora). |
| [infra/postgres/init/01-create-databases.sh](../infra/postgres/init/01-create-databases.sh) | Corre **una sola vez**, cuando el volumen de Postgres está vacío. Crea `auth_db` con su usuario `auth_user`, `repairs_db` con `repairs_user`, y las bases de test. Además revoca el acceso público, así que cada usuario solo puede entrar a *su* base. |
| [infra/pgadmin/servers.json](../infra/pgadmin/servers.json) | Deja precargada en pgAdmin la conexión al Postgres. |
| `keys/` | Las llaves RSA. Git las ignora: **nunca** se suben. Se generan con `npm run keys:generate`. |
| [scripts/smoke-test.sh](../scripts/smoke-test.sh) | Prueba todo el sistema de punta a punta con `curl`: login → token → crear cliente, motor y orden → cambiar estado. La usa el CI. |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | El pipeline de GitHub Actions (sección 7). |

---

## 3. auth-service (Express + TypeScript)

### 3.1 Cómo arranca

1. [src/index.ts](../services/auth-service/src/index.ts): conecta a la base de datos
   (`AppDataSource.initialize()`), crea el admin inicial si está activado, y
   levanta el servidor en el puerto 3001.
2. [src/app.ts](../services/auth-service/src/app.ts): arma la app de Express. El
   **orden de los middlewares** importa. Cada petición pasa por ellos de arriba a abajo:
   1. `requestId` → le pone un id único a la petición (header `X-Request-Id`).
   2. `pinoHttp` → registra la petición en los logs (oculta contraseñas y tokens).
   3. `helmet` → agrega headers de seguridad.
   4. `cors` → solo permite los orígenes de `CORS_ORIGINS` (el frontend).
   5. `express.json` → convierte el body en objeto (máx. 100 kb).
   6. `/health` → para saber si el servicio y la BD están vivos.
   7. `rateLimiter` → máximo 300 peticiones por minuto por IP.
   8. `/api/v1` → las rutas reales.
   9. `notFoundHandler` y `errorHandler` → si nada respondió o algo falló.

### 3.2 Configuración

- [src/config/env.ts](../services/auth-service/src/config/env.ts): lee las
  variables de entorno y las **valida con Zod**. Si falta algo (p. ej. `DB_PASSWORD`),
  el servicio no arranca y te dice qué falta. El resto del código usa `env.X`
  y nunca `process.env` directo.
- [src/config/data-source.ts](../services/auth-service/src/config/data-source.ts):
  conexión de TypeORM a Postgres. `synchronize: false` significa que TypeORM
  **no** cambia tablas solo. Las tablas se crean con migraciones.
- [src/config/logger.ts](../services/auth-service/src/config/logger.ts): logger
  (pino). Oculta `authorization` y las contraseñas.

### 3.3 Base de datos

- [src/db/entities/user.entity.ts](../services/auth-service/src/db/entities/user.entity.ts):
  la tabla `users`. Ojo con `passwordHash` y su `select: false`: el hash **no**
  se trae en las consultas normales, solo cuando se pide explícitamente (en el login).
- [src/db/migrations/1760000000000-CreateUsers.ts](../services/auth-service/src/db/migrations/1760000000000-CreateUsers.ts):
  el SQL que crea la tabla. `up` crea y `down` deshace.
- [src/db/seed-admin.ts](../services/auth-service/src/db/seed-admin.ts): crea el
  primer admin **solo si no existe ningún admin**. Por eso se puede ejecutar
  muchas veces sin duplicar nada (es *idempotente*).

### 3.4 Patrón de cada módulo: routes → controller → service

```
modules/users/
├── users.routes.ts      ¿Qué URL? ¿Qué middlewares? (auth, rol, validación)
├── users.controller.ts  Lee lo validado, llama al service y responde (status + JSON)
├── users.service.ts     Lógica: reglas, consultas a la BD, errores de negocio
├── users.schemas.ts     Reglas de validación de los datos de entrada (Zod)
└── users.types.ts       Tipos TypeScript (p. ej. PublicUser = usuario sin hash)
```

Ejemplo: `PATCH /api/v1/users/:id` en [users.routes.ts](../services/auth-service/src/modules/users/users.routes.ts):

```ts
usersRouter.use(authenticate);              // 1. ¿Hay un token válido?
usersRouter.patch('/:id',
  authorize('admin'),                       // 2. ¿Es admin?
  validate({ params: ..., body: ... }),     // 3. ¿Los datos son válidos?
  usersController.updateById,               // 4. Hacer el trabajo
);
```

### 3.5 Middlewares clave

| Archivo | Qué hace |
|---|---|
| [validate.ts](../services/auth-service/src/middlewares/validate.ts) | Valida body, query y params con Zod. Si algo está mal, responde 400 con el detalle de cada campo. Si está bien, guarda los datos limpios en `res.locals.validated`. |
| [authenticate.ts](../services/auth-service/src/middlewares/authenticate.ts) | Lee `Authorization: Bearer <token>`, verifica el JWT y además **vuelve a buscar al usuario en la BD**. Si lo desactivaron después del login, se le niega el acceso aunque el token no haya vencido. Deja al usuario en `req.user`. |
| [authorize.ts](../services/auth-service/src/middlewares/authorize.ts) | `authorize('admin')`: si `req.user.role` no está en la lista, responde 403. |
| [error-handler.ts](../services/auth-service/src/middlewares/error-handler.ts) | Atrapa **todos** los errores y responde siempre con el mismo formato `{ error: { code, message, details, requestId } }`. Los errores inesperados salen como 500 genérico (no filtra detalles internos). |
| [rate-limit.ts](../services/auth-service/src/middlewares/rate-limit.ts) | Límite de peticiones. El login tiene uno más estricto: 10 intentos *fallidos* cada 15 minutos. |

[src/common/errors.ts](../services/auth-service/src/common/errors.ts) define
`AppError` con atajos (`AppError.notFound()`, `.conflict()`...). Los services
lanzan estos errores (`throw AppError.conflict(...)`) y el error-handler los
convierte en la respuesta HTTP. Express 5 pasa al error-handler cualquier error,
también los de funciones `async`, por eso no hay `try/catch` en los controllers.

### 3.6 Contraseñas y JWT

- [src/utils/password.ts](../services/auth-service/src/utils/password.ts):
  `hashPassword` (bcrypt, 12 rondas) y `verifyPassword`. Nunca se guarda la
  contraseña: solo el hash.
- [src/utils/jwt.ts](../services/auth-service/src/utils/jwt.ts):
  - `signAccessToken(user)`: crea el token con `sub` (id), `email`, `role` y
    `type: "access"`, firmado con la **llave privada**, con `iss`, `aud` y
    vencimiento de 1 h.
  - `verifyAccessToken(token)`: verifica la firma con la llave pública, además
    del emisor, la audiencia y el vencimiento. Después valida el contenido con Zod.

### 3.7 El login paso a paso

[auth.service.ts](../services/auth-service/src/modules/auth/auth.service.ts):

1. Busca el usuario por email (incluyendo el hash).
2. **Siempre** compara la contraseña con bcrypt, aunque el email no exista (usa
   un hash ficticio). Así la respuesta tarda lo mismo y nadie puede adivinar qué
   emails están registrados midiendo el tiempo.
3. Si el usuario no existe, la contraseña no coincide o la cuenta está inactiva
   → mismo mensaje: *"Invalid email or password"*.
4. Guarda `last_login_at` y firma el token.
5. Responde `{ accessToken, tokenType: "Bearer", expiresIn: 3600, user }`.

---

## 4. repairs-service (FastAPI + Python)

### 4.1 Cómo arranca

[app/main.py](../services/repairs-service/app/main.py) → `create_app()`:

1. Crea la app de FastAPI (con título y descripción, que salen en `/docs`).
2. Agrega CORS y un middleware que pone el `X-Request-Id`, igual que en Express.
3. Registra los manejadores de errores (`register_exception_handlers`).
4. Incluye los routers bajo `/api/v1`.
5. Al arrancar (`lifespan`) lee la llave pública. Si no existe, falla de
   inmediato en vez de fallar en la primera petición.

En Docker, antes de arrancar se ejecuta `alembic upgrade head` (ver el `CMD` del
[Dockerfile](../services/repairs-service/Dockerfile)), que crea o actualiza las tablas.

### 4.2 Las capas (lo más importante para la sustentación)

El enunciado pide *"separación entre rutas, lógica de negocio y acceso a datos"*:

```
Petición HTTP
   │
   ▼
routers/      ← HTTP: qué URL, qué parámetros, qué rol, qué responde
   │
   ▼
services/     ← Reglas de negocio: duplicados, flujo de estados, validaciones
   │
   ▼
repositories/ ← SQL: consultas, filtros, paginación (no saben de reglas ni de HTTP)
   │
   ▼
models/       ← Tablas (SQLAlchemy)
```

`schemas/` (Pydantic) define qué datos **entran** y qué datos **salen**.

Así se ve en el código ([routers/clients.py](../services/repairs-service/app/routers/clients.py)):

```python
@router.post("", status_code=201, response_model=DataResponse[ClientOut])
def create_client(body: ClientCreate, db: DbSession, _: AuthenticatedUser):
    return {"data": ClientService(db).create(body)}
```

En esa línea FastAPI hace solo cuatro cosas:
- `body: ClientCreate` → valida el JSON con Pydantic (si está mal, responde 400).
- `db: DbSession` → abre una sesión de BD para esta petición y la cierra al final.
- `_: AuthenticatedUser` → **exige un token válido** (si no, responde 401).
- `response_model=...` → filtra la respuesta: solo salen los campos de `ClientOut`.

### 4.3 Archivo por archivo

| Archivo | Qué hace |
|---|---|
| [config.py](../services/repairs-service/app/config.py) | Variables de entorno con prefijo `REPAIRS_` (Pydantic Settings). Lee también el `.env`. |
| [database.py](../services/repairs-service/app/database.py) | Conexión a Postgres, `Base` de los modelos y `get_db()` (una sesión por petición). |
| [security.py](../services/repairs-service/app/security.py) | **El puente con el auth-service** (ver sección 5). |
| [core/errors.py](../services/repairs-service/app/core/errors.py) | `AppError`, `NotFoundError` (404), `ConflictError` (409), `BusinessRuleError` (422)... y los manejadores que convierten cada error al mismo formato JSON que usa Express. |
| [core/workflow.py](../services/repairs-service/app/core/workflow.py) | El **mapa de estados**: desde cada estado, a cuáles se puede pasar. |
| [models/client.py](../services/repairs-service/app/models/client.py), [engine.py](../services/repairs-service/app/models/engine.py), [repair_order.py](../services/repairs-service/app/models/repair_order.py) | Las tablas. `repair_order.py` tiene también `OrderStatusHistory` (historial) y la secuencia del número de orden. |
| [models/mixins.py](../services/repairs-service/app/models/mixins.py) | Columnas repetidas: `id` (UUID), `created_at` y `updated_at`. |
| [schemas/common.py](../services/repairs-service/app/schemas/common.py) | Tipos de texto reutilizables (recortan espacios, limitan el largo, convierten a mayúsculas), paginación y los formatos `{data}` y `{data, meta}`. |
| [schemas/clients.py](../services/repairs-service/app/schemas/clients.py) etc. | `ClientCreate` (entrada al crear), `ClientUpdate` (todo opcional), `ClientOut` (salida). `extra="forbid"`: si mandas un campo que no existe → 400. |
| [repositories/*.py](../services/repairs-service/app/repositories/) | Consultas: `get`, `list` con filtros, búsqueda `ILIKE` y paginación. `escape_like` evita que un `%` escrito por el usuario funcione como comodín. |
| [services/clients.py](../services/repairs-service/app/services/clients.py) | Crear (revisa duplicados → 409), editar, desactivar. |
| [services/engines.py](../services/repairs-service/app/services/engines.py) | Igual, y además: el cliente debe existir (404) y estar activo (422). |
| [services/orders.py](../services/repairs-service/app/services/orders.py) | Lo más interesante, ver sección 6. |
| [routers/deps.py](../services/repairs-service/app/routers/deps.py) | Dependencias compartidas: sesión de BD, paginación y búsqueda. |
| [routers/health.py](../services/repairs-service/app/routers/health.py) | `/health` (público): hace `SELECT 1` a la BD. |
| [alembic/versions/0001_initial_schema.py](../services/repairs-service/alembic/versions/0001_initial_schema.py) | La migración que crea las 4 tablas, los enums, la secuencia, los índices y los `CHECK`. |

---

## 5. Cómo se conectan los dos backends

Es lo que más te van a preguntar. El repairs-service **nunca** llama al
auth-service por HTTP ni lee su base de datos. La conexión es **solo el token** y
la **llave pública**.

[security.py](../services/repairs-service/app/security.py) paso a paso:

```python
def get_current_user(credentials = Depends(bearer_scheme)) -> CurrentUser:
    # 1. ¿Viene el header "Authorization: Bearer xxx"? Si no → 401
    ...
    return decode_access_token(credentials.credentials)

def decode_access_token(token):
    payload = jwt.decode(
        token,
        key=get_public_key(),            # 2. llave PÚBLICA del auth-service
        algorithms=["RS256"],            # 3. SOLO RS256 (bloquea "none" y HS256)
        issuer="mining-repairs-auth",    # 4. lo emitió nuestro auth-service
        audience="mining-repairs-api",   # 5. está dirigido a esta API
        options={"require": ["exp", "iat", "iss", "aud", "sub"]},  # 6. claims obligatorios
    )
    # jwt.decode ya verificó la FIRMA y el VENCIMIENTO (exp)
    # 7. type == "access" y role válido
    return CurrentUser(id=payload["sub"], email=..., role=...)
```

Y en las rutas:
- `AuthenticatedUser` → cualquier usuario con token válido.
- `AdminUser` → además debe tener `role == "admin"` (si no, 403).

**¿Qué pasa si alguien cambia `"role": "operator"` por `"admin"` dentro del
token?** La firma ya no coincide con el contenido → 401. Hay un test exacto
para esto: `test_tampered_payload_is_rejected`.

**¿Cómo sabe el repairs-service quién creó la orden si no tiene la tabla de
usuarios?** Lo saca del token: `created_by = user.id` (el `sub`) y
`created_by_email = user.email`. Se guarda como texto, sin llave foránea.

**Lo que tiene que coincidir entre los dos servicios:**

| Auth-service | Repairs-service |
|---|---|
| `JWT_PRIVATE_KEY_PATH` (firma) | `REPAIRS_JWT_PUBLIC_KEY_PATH` (pública **del mismo par**) |
| `JWT_ISSUER` | `REPAIRS_JWT_ISSUER` |
| `JWT_AUDIENCE` | `REPAIRS_JWT_AUDIENCE` |

Si regeneras las llaves, reinicia ambos servicios y vuelve a hacer login (los
tokens viejos dejan de ser válidos).

---

## 6. La vida de una orden (qué archivo actúa en cada paso)

**Crear:** `POST /api/v1/orders` con `{ engine_id, reported_problem, technician, estimated_delivery_date }`

1. `routers/orders.py` → `create_order`. Valida el token (`AuthenticatedUser`) y el body (`OrderCreate`).
   `OrderCreate` revisa que la fecha estimada no sea anterior a la recepción (si no, 400).
2. `services/orders.py` → `OrderService.create`:
   - El motor existe (si no, 404), está activo y su cliente también (si no, 422).
   - El motor no tiene otra orden sin entregar (si no, 422).
   - Genera el número `OR-2026-000001` con la secuencia de Postgres (`repositories/orders.py → next_order_number`).
   - El cliente se toma del motor (`client_id=engine.client_id`), no del request.
   - Estado inicial `RECEIVED` y primera fila del historial.
   - `commit()`: todo se guarda junto o no se guarda nada.
3. Responde 201 con la orden completa, incluido `allowed_next_statuses: ["IN_DIAGNOSIS"]`,
   que le sirve al frontend para mostrar solo los botones válidos.

**Cambiar de estado:** `PATCH /api/v1/orders/{id}/status` con `{ status, note?, diagnosis?, work_performed?, observations? }`

1. `OrderService.change_status` lee la orden **con bloqueo** (`for_update=True`),
   para que dos personas no la cambien al mismo tiempo.
2. `can_transition(actual, nuevo)` revisa el mapa de `core/workflow.py`. Si no
   se permite → 422 con los estados permitidos en el mensaje.
3. Si el nuevo estado es `DELIVERED`, guarda `actual_delivery_date` (hoy, o la
   fecha que envíes).
4. Si vienen `diagnosis`, `work_performed` u `observations`, los guarda en la orden
   (así se registra el avance sin un formulario de edición libre).
5. Agrega una fila a `order_status_history`: de qué estado a cuál, la nota, y quién (desde el token).

**Consultar:** `GET /orders/{id}` trae la orden con motor, cliente e historial.
`GET /orders?status=IN_REPAIR&search=CAT` filtra. `GET /orders/summary` cuenta
cuántas órdenes hay por estado (para el dashboard).

---

## 6.5 El frontend (React)

**Cómo arranca:** [main.tsx](../frontend/src/main.tsx) monta los providers en este orden:
React Query (caché de datos) → Toasts (avisos) → Auth (sesión) → Router (páginas).

**El camino de una petición:**

```
Página (p. ej. OrdersPage)
  └─ useQuery({ queryKey: ['orders', 'list', filtros], queryFn: () => ordersApi.list(filtros) })
       └─ api/endpoints.ts  → ordersApi.list → request(repairsApiUrl, '/orders', { query })
            └─ api/http.ts  → agrega "Authorization: Bearer <token>", hace fetch,
                              y si la respuesta es un error la convierte en ApiError
```

| Archivo | Qué hace |
|---|---|
| [api/http.ts](../frontend/src/api/http.ts) | El único lugar que hace `fetch`. Pone el token, arma la URL con los filtros y convierte `{ error: { code, message } }` en un `ApiError`. Si llega un **401**, avisa al AuthProvider para cerrar la sesión. |
| [api/errors.ts](../frontend/src/api/errors.ts) | Traduce los errores de las APIs (en inglés) a mensajes en español para el usuario. |
| [api/endpoints.ts](../frontend/src/api/endpoints.ts) | Una función por endpoint de las dos APIs (`authApi`, `usersApi`, `clientsApi`, `enginesApi`, `ordersApi`). |
| [auth/session.ts](../frontend/src/auth/session.ts) | Guarda `{ token, user, expiresAt }` en `sessionStorage`. |
| [auth/AuthContext.tsx](../frontend/src/auth/AuthContext.tsx) | `login()` llama al auth-service y guarda la sesión. `logout()` la borra y limpia la caché. Programa el cierre automático cuando vence el token. |
| [auth/guards.tsx](../frontend/src/auth/guards.tsx) | `RequireAuth` manda al login si no hay sesión (y recuerda a dónde ibas). `RequireAdmin` protege `/users`. |
| [router.tsx](../frontend/src/router.tsx) | Las rutas. Cada página se descarga solo cuando se visita (`lazy`). |
| [lib/labels.ts](../frontend/src/lib/labels.ts) | Traduce los códigos (`IN_REPAIR`) a texto (`En reparación`) y define el color de cada estado. |
| [pages/orders/StatusChangePanel.tsx](../frontend/src/pages/orders/StatusChangePanel.tsx) | Los botones de "siguiente paso" salen de `allowed_next_statuses`, que manda la API. El front nunca ofrece un cambio que el backend rechazaría. Aquí también se registra el diagnóstico y el trabajo realizado. |

**React Query en dos frases:** guarda en caché cada respuesta bajo una `queryKey`.
Después de crear o editar algo se llama a `invalidateQueries(['clients'])` y todas
las listas de clientes se recargan solas. Además da `isPending` (indicador de carga)
e `isError` (mensaje de error) sin escribir esa lógica a mano.

**Formularios:** react-hook-form + Zod con las mismas reglas que la API (largos,
formatos, fechas). Así la mayoría de los errores se ven antes de enviar, y los que
solo conoce el servidor (duplicados, reglas de negocio) se muestran arriba del
formulario.

**Por qué CORS importa:** el front (`localhost:5173`) llama a otros dos orígenes
(`:3001` y `:8000`). El navegador solo lo permite porque ambas APIs tienen
`http://localhost:5173` en `CORS_ORIGINS`. Si cambias el puerto del front, hay
que cambiarlo también ahí.

---

## 7. Pruebas y pipeline

**auth-service** (`npm test`, Vitest):
- `tests/unit/password.test.ts` → hash y verificación de contraseñas.
- `tests/unit/jwt.test.ts` → firmar y verificar; firma alterada rechazada.
- `tests/integration/auth.test.ts` → levanta la app contra `auth_db_test`,
  recrea las tablas con las migraciones y prueba login, 401, 409, etc.
- `tests/integration/users.test.ts` → roles (un operador recibe 403 en la
  administración), usuarios desactivados (no entran y su token deja de servir),
  cambio de contraseña, editar/desactivar usuarios y tokens vencidos,
  firmados con otra llave o con el payload modificado.
- `tests/helpers.ts` → utilidades: recrear la base, insertar usuarios y firmar
  tokens a mano (por ejemplo, ya vencidos) para probar los casos de error.
- `tests/setup-env.ts` → variables por defecto para los tests. Si el CI define
  otras, se usan las del CI.

**repairs-service** (`pytest`):
- `tests/conftest.py` → **el más importante**. Genera un par de llaves RSA de
  prueba, apunta el servicio a `repairs_db_test`, recrea el esquema con Alembic,
  limpia las tablas después de cada test y tiene `make_token()` para fabricar
  tokens como lo haría Express (o tokens trucados para los tests de ataque).
- `test_security.py` → token ausente, vencido, de otra llave, modificado,
  `alg: none`, HS256, issuer/audience/type/role incorrectos.
- `test_clients.py`, `test_engines.py` → CRUD, duplicados, validaciones, permisos de admin.
- `test_orders.py` → creación, ciclo completo hasta `DELIVERED`, saltos inválidos, filtros, resumen.
- `test_workflow.py` → el mapa de estados (sin BD).
- `test_clock.py` → la fecha del negocio usa la zona horaria del taller (8 p. m. en Bogotá sigue siendo "hoy").

**frontend** (`npm test`, Vitest + Testing Library):
- `api/http.test.ts` → pone el token, convierte errores, cierra sesión con 401 (pero no en el login).
- `pages/LoginPage.test.tsx` → validación, credenciales incorrectas, login exitoso, redirección.
- `pages/orders/StatusChangePanel.test.tsx` → solo muestra los estados permitidos y envía lo correcto.

**Pipeline** ([ci.yml](../.github/workflows/ci.yml)), 5 jobs (el del frontend corre en paralelo con los backends):
1. `auth-service`: ESLint → `tsc` → genera llaves → tests (con un Postgres temporal) → build.
2. `repairs-service`: Ruff → tests con cobertura → `alembic check` (los modelos coinciden con las migraciones).
3. `e2e` (si 1 y 2 pasan): `docker compose up` con todo y `smoke-test.sh`. Es el "entorno de pruebas".
4. `publish` (solo en `main`): publica las imágenes Docker en GitHub Container Registry.

---

## 8. Cómo hacer una modificación menor (probable en la sustentación)

**Ejemplo: agregar el campo `phone` (opcional) a los clientes.**

1. Modelo, en [models/client.py](../services/repairs-service/app/models/client.py):
   ```python
   phone: Mapped[str | None] = mapped_column(String(30))
   ```
2. Migración, generada automáticamente comparando el modelo con la BD:
   ```bash
   cd services/repairs-service
   alembic revision --autogenerate -m "add client phone"
   alembic upgrade head
   ```
   Revisa el archivo nuevo en `alembic/versions/` antes de aplicarlo.
3. Schemas, en [schemas/clients.py](../services/repairs-service/app/schemas/clients.py):
   `phone: str | None = None` en `ClientCreate` y `ClientUpdate`, y
   `phone: str | None` en `ClientOut`.
4. Test: agrega `"phone": "3001234567"` en `test_create_client` y comprueba que vuelve en la respuesta.
5. `pytest` y `ruff check .`

No hace falta tocar el router, el service ni el repository: `Client(**data.model_dump())`
ya pasa todos los campos. Esa es la ventaja de separar en capas.

**Ejemplo: permitir pasar de `IN_DIAGNOSIS` directo a `IN_REPAIR`.** Solo hay que
cambiar una línea en [core/workflow.py](../services/repairs-service/app/core/workflow.py)
(y ajustar el test que lo prohíbe, si existe).

**En el auth-service, agregar un campo al usuario:** entidad
(`user.entity.ts`) → `npm run migration:generate -- src/db/migrations/AddX` →
schema Zod (`users.schemas.ts`) → `toPublicUser` en `users.service.ts` → test.

---

## 9. Preguntas probables y respuestas cortas

- **¿Por qué dos bases de datos?** Cada servicio es dueño de sus datos. El
  usuario de cada base no puede ni conectarse a la otra (permiso `CONNECT`
  revocado). Si un servicio cambia sus tablas, el otro no se entera ni se rompe.
- **¿Por qué RS256 y no un secreto compartido?** Con un secreto compartido,
  FastAPI también podría *crear* tokens. Con RS256 solo puede verificarlos.
- **¿Qué pasa cuando el token vence?** FastAPI responde 401 `TOKEN_EXPIRED` y el
  frontend debe mandar al usuario a hacer login otra vez.
- **Si desactivo un usuario, ¿pierde el acceso al instante?** En el auth-service
  sí (revisa la BD en cada petición). En el repairs-service, como máximo cuando
  vence el token (1 h). Es el costo de que los servicios sean independientes, y
  por eso el token dura poco.
- **¿Cómo evitas duplicados?** Doble capa: el service revisa antes de guardar
  (409 con un mensaje claro) y la BD tiene `UNIQUE` por si dos peticiones llegan
  al mismo tiempo.
- **¿Por qué no se borran clientes ni motores?** Porque tienen órdenes
  históricas. Se desactivan (`is_active = false`).
- **¿Por qué el cliente de la orden no se manda en el request?** Porque se
  deduce del motor. Así es imposible crear una orden con un cliente que no es el
  dueño del motor.
- **¿Qué valida el pipeline antes de integrar a main?** Lint, tipos, tests de
  ambos servicios con Postgres real, que el esquema coincida con las migraciones,
  y una prueba end-to-end con Docker.
- **¿Dónde se ve la documentación de la API?** `http://localhost:8000/docs`
  (Swagger, generado por FastAPI) y los README de cada servicio.
