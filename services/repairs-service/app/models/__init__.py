"""SQLAlchemy models. Importing this package registers every table on Base.metadata."""

from app.database import Base
from app.models.client import Client, IdentificationType
from app.models.engine import Engine
from app.models.repair_order import OrderStatus, OrderStatusHistory, RepairOrder

__all__ = [
    "Base",
    "Client",
    "Engine",
    "IdentificationType",
    "OrderStatus",
    "OrderStatusHistory",
    "RepairOrder",
]
