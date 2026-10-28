import enum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class IdentificationType(str, enum.Enum):
    NIT = "NIT"  # Company tax id
    CC = "CC"  # Citizenship card
    CE = "CE"  # Foreigner id
    PASSPORT = "PASSPORT"


class Client(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "clients"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    identification_type: Mapped[IdentificationType] = mapped_column(
        Enum(IdentificationType, name="identification_type"), nullable=False
    )
    # Unique: the same company/person cannot be registered twice.
    identification_number: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(160), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    engines = relationship("Engine", back_populates="client")
