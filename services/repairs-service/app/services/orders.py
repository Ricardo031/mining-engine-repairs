import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, NotFoundError
from app.core.workflow import allowed_next_statuses, can_transition
from app.models import OrderStatus, OrderStatusHistory, RepairOrder
from app.repositories.orders import OrderRepository
from app.schemas.common import PaginationParams
from app.schemas.orders import OrderCreate, OrdersSummary, OrderStatusUpdate, StatusCount
from app.security import CurrentUser
from app.services.engines import EngineService

S = OrderStatus


class OrderService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.orders = OrderRepository(db)
        self.engines = EngineService(db)

    def create(self, data: OrderCreate, user: CurrentUser) -> RepairOrder:
        engine = self.engines.get(data.engine_id)
        if not engine.is_active:
            raise BusinessRuleError("Cannot create an order for an inactive engine")
        if not engine.client.is_active:
            raise BusinessRuleError("Cannot create an order for an inactive client")
        if self.orders.has_open_order_for_engine(engine.id):
            raise BusinessRuleError("This engine already has an open repair order")

        order = RepairOrder(
            **data.model_dump(),
            order_number=self.orders.next_order_number(date.today()),
            client_id=engine.client_id,
            status=S.RECEIVED,
            created_by=user.id,
            created_by_email=user.email,
        )
        self.orders.add(order)
        self.orders.add_history(
            OrderStatusHistory(
                order_id=order.id,
                from_status=None,
                to_status=S.RECEIVED,
                note="Order created",
                changed_by=user.id,
                changed_by_email=user.email,
            )
        )
        self.db.commit()
        return self.get(order.id)

    def list(
        self,
        pagination: PaginationParams,
        status: OrderStatus | None,
        client_id: uuid.UUID | None,
        engine_id: uuid.UUID | None,
        search: str | None,
    ) -> tuple[list[RepairOrder], int]:
        return self.orders.list(
            offset=pagination.offset,
            limit=pagination.limit,
            status=status,
            client_id=client_id,
            engine_id=engine_id,
            search=search,
        )

    def get(self, order_id: uuid.UUID) -> RepairOrder:
        order = self.orders.get(order_id)
        if order is None:
            raise NotFoundError("Repair order not found")
        return order

    def get_by_number(self, order_number: str) -> RepairOrder:
        order = self.orders.get_by_number(order_number)
        if order is None:
            raise NotFoundError("Repair order not found")
        return order

    def change_status(self, order_id: uuid.UUID, data: OrderStatusUpdate, user: CurrentUser) -> RepairOrder:
        order = self.orders.get(order_id, for_update=True)
        if order is None:
            raise NotFoundError("Repair order not found")
        current = order.status

        if not can_transition(current, data.status):
            allowed = ", ".join(s.value for s in allowed_next_statuses(current)) or "none"
            raise BusinessRuleError(
                f"Invalid status change {current.value} -> {data.status.value}. Allowed: {allowed}"
            )

        if data.status is S.DELIVERED:
            delivered_on = data.actual_delivery_date or date.today()
            if delivered_on < order.received_at:
                raise BusinessRuleError("actual_delivery_date cannot be before the reception date")
            order.actual_delivery_date = delivered_on
        elif data.actual_delivery_date is not None:
            raise BusinessRuleError("actual_delivery_date can only be set when delivering")

        # Progress details travel with the status change; there is no free edit of the order.
        for field in ("diagnosis", "work_performed", "observations"):
            value = getattr(data, field)
            if value is not None:
                setattr(order, field, value)

        order.status = data.status
        self.orders.add_history(
            OrderStatusHistory(
                order_id=order.id,
                from_status=current,
                to_status=data.status,
                note=data.note,
                changed_by=user.id,
                changed_by_email=user.email,
            )
        )
        self.db.commit()
        return self.get(order.id)

    def summary(self) -> OrdersSummary:
        counts = self.orders.count_by_status()
        by_status = [StatusCount(status=s, count=counts.get(s, 0)) for s in OrderStatus]
        return OrdersSummary(total=sum(counts.values()), by_status=by_status)
