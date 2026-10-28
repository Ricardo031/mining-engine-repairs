from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.database import engine

router = APIRouter(tags=["Health"])


@router.get("/health")
def health() -> JSONResponse:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        database_up = True
    except Exception:
        database_up = False

    return JSONResponse(
        status_code=200 if database_up else 503,
        content={
            "status": "ok" if database_up else "degraded",
            "service": "repairs-service",
            "database": "up" if database_up else "down",
            "timestamp": datetime.now(UTC).isoformat(),
        },
    )
