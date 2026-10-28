import uuid
from datetime import date

from fastapi import APIRouter
from fastapi import status as http_status

from app.models import OrderStatus
from app.routers.deps import ERROR_RESPONSES, DbSession, Pagination, SearchQuery
from app.schemas.common import DataResponse, PaginatedResponse, PaginationMeta
from app.schemas.orders import (
    OrderCreate,
    OrderListItem,
    OrderOut,
    OrdersSummary,
    OrderStatusUpdate,
)
from app.security import AuthenticatedUser
from app.services.orders import OrderService

router = APIRouter(prefix="/orders", tags=["Repair orders"], responses=ERROR_RESPONSES)


@router.post(
    "",
    status_code=http_status.HTTP_201_CREATED,
    response_model=DataResponse[OrderOut],
    responses={
        404: {"description": "Engine not found"},
        422: {"description": "Inactive engine/client or engine with an open order"},
    },
)
def create_order(body: OrderCreate, db: DbSession, user: AuthenticatedUser):
    """Creates the order in RECEIVED status. Client and order number are set by the server."""
    return {"data": OrderService(db).create(body, user)}


@router.get("", response_model=PaginatedResponse[OrderListItem])
def list_orders(
    db: DbSession,
    _: AuthenticatedUser,
    pagination: Pagination,
    status: OrderStatus | None = None,
    client_id: uuid.UUID | None = None,
    engine_id: uuid.UUID | None = None,
    search: SearchQuery = None,
):
    """Search matches order number, technician, engine serial number or client name."""
    items, total = OrderService(db).list(pagination, status, client_id, engine_id, search)
    return {"data": items, "meta": PaginationMeta.build(pagination, total)}


@router.get("/summary", response_model=DataResponse[OrdersSummary])
def orders_summary(db: DbSession, _: AuthenticatedUser, today: date | None = None):
    """Dashboard numbers: orders per status, deliveries due, monthly deliveries and recent intake.

    `today` (YYYY-MM-DD) lets the client use its own time zone; defaults to the server date.
    """
    return {"data": OrderService(db).summary(today)}


@router.get("/by-number/{order_number}", response_model=DataResponse[OrderOut])
def get_order_by_number(order_number: str, db: DbSession, _: AuthenticatedUser):
    return {"data": OrderService(db).get_by_number(order_number)}


@router.get("/{order_id}", response_model=DataResponse[OrderOut])
def get_order(order_id: uuid.UUID, db: DbSession, _: AuthenticatedUser):
    """Full order detail including its status history."""
    return {"data": OrderService(db).get(order_id)}


@router.patch(
    "/{order_id}/status",
    response_model=DataResponse[OrderOut],
    responses={422: {"description": "Status change not allowed by the workflow"}},
)
def change_order_status(order_id: uuid.UUID, body: OrderStatusUpdate, db: DbSession, user: AuthenticatedUser):
    """Moves the order to the next status and records it in the history."""
    return {"data": OrderService(db).change_status(order_id, body, user)}
