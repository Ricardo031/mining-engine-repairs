import uuid
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Client, Engine, OrderStatus, OrderStatusHistory, RepairOrder
from app.models.repair_order import order_number_seq
from app.repositories.base import escape_like, paginate


class OrderRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_order_number(self, today: date) -> str:
        sequence_value = self.db.scalar(select(order_number_seq.next_value()))
        return f"OR-{today.year}-{sequence_value:06d}"

    def get(self, order_id: uuid.UUID, *, for_update: bool = False) -> RepairOrder | None:
        query = (
            select(RepairOrder)
            .where(RepairOrder.id == order_id)
            .options(selectinload(RepairOrder.status_history))
            # Always reload from the database, even if the order is already in the session.
            .execution_options(populate_existing=True)
        )
        if for_update:
            # Row lock: two concurrent status changes cannot both read the same status.
            query = query.with_for_update(of=RepairOrder)
        return self.db.scalar(query)

    def get_by_number(self, order_number: str) -> RepairOrder | None:
        return self.db.scalar(
            select(RepairOrder)
            .where(RepairOrder.order_number == order_number.upper())
            .options(selectinload(RepairOrder.status_history))
        )

    def list(
        self,
        *,
        offset: int,
        limit: int,
        status: OrderStatus | None = None,
        client_id: uuid.UUID | None = None,
        engine_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> tuple[list[RepairOrder], int]:
        query = select(RepairOrder)
        if status is not None:
            query = query.where(RepairOrder.status == status)
        if client_id is not None:
            query = query.where(RepairOrder.client_id == client_id)
        if engine_id is not None:
            query = query.where(RepairOrder.engine_id == engine_id)
        if search:
            pattern = f"%{escape_like(search)}%"
            query = (
                query.join(Engine, RepairOrder.engine_id == Engine.id)
                .join(Client, RepairOrder.client_id == Client.id)
                .where(
                    or_(
                        RepairOrder.order_number.ilike(pattern, escape="\\"),
                        RepairOrder.technician.ilike(pattern, escape="\\"),
                        Engine.serial_number.ilike(pattern, escape="\\"),
                        Client.name.ilike(pattern, escape="\\"),
                    )
                )
            )
        return paginate(self.db, query.order_by(RepairOrder.created_at.desc()), offset, limit)

    def count_by_status(self) -> dict[OrderStatus, int]:
        rows = self.db.execute(select(RepairOrder.status, func.count()).group_by(RepairOrder.status)).all()
        return {status: count for status, count in rows}

    def has_open_order_for_engine(self, engine_id: uuid.UUID) -> bool:
        open_statuses = [s for s in OrderStatus if s is not OrderStatus.DELIVERED]
        return bool(
            self.db.scalar(
                select(func.count())
                .select_from(RepairOrder)
                .where(RepairOrder.engine_id == engine_id, RepairOrder.status.in_(open_statuses))
            )
        )

    def add(self, order: RepairOrder) -> RepairOrder:
        self.db.add(order)
        self.db.flush()
        return order

    def add_history(self, entry: OrderStatusHistory) -> None:
        self.db.add(entry)
        self.db.flush()
