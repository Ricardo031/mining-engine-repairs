from fastapi import APIRouter

from app.database import engine
from sqlalchemy import text

router = APIRouter()


@router.get("/health")
def health() -> dict:
    try:
        with engine.begin() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "service": "repairs-service"}
    except Exception:
        from fastapi import Response

        return Response(
            content='{"status": "degraded"}',
            status_code=503,
            media_type="application/json",
        )
