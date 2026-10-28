"""Application factory for the repairs business API."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import models  # noqa: F401  (registers models on Base metadata)
from app.config import settings
from app.database import engine
from app.routers import auth, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    # For local/dev convenience the schema is created from metadata; in
    # environments with migrations this is replaced by alembic upgrades.
    models.Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mining Repairs - Business API",
        description=(
            "Manages customers, heavy mining machinery engines and repair orders. "
            "It does not handle credentials: it validates the JWT issued by the auth service."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    app.include_router(health.router)
    app.include_router(auth.router, prefix="/api/v1")

    return app


app = create_app()
