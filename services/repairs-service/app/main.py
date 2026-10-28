"""Application factory for the repairs business API."""

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.errors import register_exception_handlers
from app.database import engine
from app.routers import auth, clients, engines, health, orders
from app.security import get_public_key

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

MAX_INCOMING_ID_LENGTH = 100


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Fail fast if the public key is missing instead of failing on the first request.
    get_public_key()
    yield
    engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mining Repairs - Business API",
        description=(
            "Manages clients, heavy mining engines and repair orders.\n\n"
            "This service never handles passwords. Every `/api/v1` endpoint requires a "
            "JWT issued by the auth service (`POST /api/v1/auth/login` on port 3001), "
            "sent as `Authorization: Bearer <token>`. The signature (RS256), expiration, "
            "issuer and audience are verified with the auth service public key."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
        expose_headers=["X-Request-Id"],
        allow_credentials=False,
        max_age=600,
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        """Every response carries X-Request-Id, same as the auth service."""
        incoming = request.headers.get("x-request-id")
        request_id = incoming if incoming and len(incoming) <= MAX_INCOMING_ID_LENGTH else str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response

    register_exception_handlers(app)

    app.include_router(health.router)
    for router in (auth.router, clients.router, engines.router, orders.router):
        app.include_router(router, prefix="/api/v1")

    return app


app = create_app()
