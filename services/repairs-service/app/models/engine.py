import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.client import Client
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Engine(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "engines"

    # Internal code or manufacturer serial number; unique across the workshop.
    serial_number: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    manufacturer: Mapped[str] = mapped_column(String(120), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    engine_type: Mapped[str] = mapped_column(String(120), nullable=False)
    power: Mapped[str] = mapped_column(String(60), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    client: Mapped[Client] = relationship(back_populates="engines", lazy="joined")
