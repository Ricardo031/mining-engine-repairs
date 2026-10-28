"""Database models for the repairs service."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models import clients, engines, orders  # noqa: E402,F401
