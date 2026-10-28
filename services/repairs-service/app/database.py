"""Database engine and session for the repairs service."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=settings.environment == "development",
)


def get_db():
    """FastAPI dependency that yields a database session per request."""
    from sqlalchemy.orm import Session

    db: Session = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()
