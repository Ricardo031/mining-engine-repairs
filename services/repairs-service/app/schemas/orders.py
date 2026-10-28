import uuid
from datetime import date, datetime

from pydantic import Field, computed_field, model_validator

from app.core.workflow import allowed_next_statuses
from app.models import OrderStatus
from app.schemas.clients import ClientSummary
from app.schemas.common import InputModel, LongText, NoteText, OutputModel, PersonName
from app.schemas.engines import EngineSummary


class OrderCreate(InputModel):
    engine_id: uuid.UUID
    received_at: date = Field(default_factory=date.today, description="Reception date")
    reported_problem: LongText
    diagnosis: LongText | None = None
    work_performed: LongText | None = Field(None, description="Work done or repair required")
    technician: PersonName
    estimated_delivery_date: date
    observations: LongText | None = None

    @model_validator(mode="after")
    def check_dates(self) -> "OrderCreate":
        if self.estimated_delivery_date < self.received_at:
            raise ValueError("estimated_delivery_date cannot be before received_at")
        return self


class OrderStatusUpdate(InputModel):
    status: OrderStatus
    note: NoteText | None = None
    # Only used when moving to DELIVERED; defaults to today.
    actual_delivery_date: date | None = None
    # Optional progress details recorded together with the status change
    # (e.g. the diagnosis when leaving IN_DIAGNOSIS). Omitted fields keep their value.
    diagnosis: LongText | None = None
    work_performed: LongText | None = Field(None, description="Work done or repair required")
    observations: LongText | None = None


class StatusHistoryOut(OutputModel):
    id: uuid.UUID
    from_status: OrderStatus | None
    to_status: OrderStatus
    note: str | None
    changed_by: str
    changed_by_email: str
    changed_at: datetime


class OrderListItem(OutputModel):
    id: uuid.UUID
    order_number: str
    status: OrderStatus
    engine: EngineSummary
    client: ClientSummary
    technician: str
    received_at: date
    estimated_delivery_date: date
    actual_delivery_date: date | None
    created_at: datetime
    updated_at: datetime


class OrderOut(OrderListItem):
    reported_problem: str
    diagnosis: str | None
    work_performed: str | None
    observations: str | None
    created_by: str
    created_by_email: str
    status_history: list[StatusHistoryOut]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def allowed_next_statuses(self) -> list[OrderStatus]:
        """Statuses the order can move to next (useful for the UI)."""
        return allowed_next_statuses(self.status)


class StatusCount(OutputModel):
    status: OrderStatus
    count: int


class DayCount(OutputModel):
    date: date
    count: int


class OrdersSummary(OutputModel):
    """Dashboard numbers. Dates are relative to `today` (sent by the client to use its time zone)."""

    today: date
    total: int
    by_status: list[StatusCount]
    active: int = Field(description="Orders not delivered yet (still in the workshop)")
    overdue: int = Field(description="Active orders whose estimated delivery date already passed")
    due_soon: int = Field(description="Active orders due today or in the next 6 days")
    delivered_this_month: int
    delivered_last_month: int
    received_last_7_days: int
    received_previous_7_days: int
    received_by_day: list[DayCount] = Field(description="Orders received on each of the last 7 days")
