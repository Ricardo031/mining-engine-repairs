import enum
import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Sequence, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.client import Client
from app.models.engine import Engine
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class OrderStatus(str, enum.Enum):
    RECEIVED = "RECEIVED"  # Recibido
    IN_DIAGNOSIS = "IN_DIAGNOSIS"  # En diagnóstico
    AWAITING_APPROVAL = "AWAITING_APPROVAL"  # Esperando aprobación
    IN_REPAIR = "IN_REPAIR"  # En reparación
    IN_TESTING = "IN_TESTING"  # En pruebas
    COMPLETED = "COMPLETED"  # Finalizado
    DELIVERED = "DELIVERED"  # Entregado


order_status_enum = Enum(OrderStatus, name="order_status")

# Feeds the human readable order number: OR-<year>-<000001>.
order_number_seq = Sequence("repair_order_number_seq", metadata=Base.metadata)


class RepairOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "repair_orders"
    __table_args__ = (
        CheckConstraint("estimated_delivery_date >= received_at", name="estimated_after_received"),
        CheckConstraint(
            "actual_delivery_date IS NULL OR actual_delivery_date >= received_at",
            name="delivered_after_received",
        ),
    )

    order_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    engine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("engines.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Owner at reception time. Stored so history stays correct if the engine changes owner.
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    received_at: Mapped[date] = mapped_column(Date, nullable=False)
    reported_problem: Mapped[str] = mapped_column(Text, nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(Text)
    work_performed: Mapped[str | None] = mapped_column(Text)
    # Reference only: technicians are not users of the platform.
    technician: Mapped[str] = mapped_column(String(120), nullable=False)
    estimated_delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_delivery_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[OrderStatus] = mapped_column(
        order_status_enum, nullable=False, default=OrderStatus.RECEIVED, index=True
    )
    observations: Mapped[str | None] = mapped_column(Text)
    # Id/email of the auth-service user (no FK: users live in another database).
    created_by: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by_email: Mapped[str] = mapped_column(String(160), nullable=False)

    engine: Mapped[Engine] = relationship(lazy="joined")
    client: Mapped[Client] = relationship(lazy="joined")
    status_history: Mapped[list["OrderStatusHistory"]] = relationship(
        back_populates="order",
        order_by="OrderStatusHistory.changed_at",
        cascade="all, delete-orphan",
    )


class OrderStatusHistory(UUIDPrimaryKeyMixin, Base):
    """One row per status change, including the initial RECEIVED status."""

    __tablename__ = "order_status_history"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[OrderStatus | None] = mapped_column(order_status_enum)
    to_status: Mapped[OrderStatus] = mapped_column(order_status_enum, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    changed_by: Mapped[str] = mapped_column(String(64), nullable=False)
    changed_by_email: Mapped[str] = mapped_column(String(160), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order: Mapped[RepairOrder] = relationship(back_populates="status_history")
