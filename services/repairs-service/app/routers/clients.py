import uuid

from fastapi import APIRouter, status

from app.routers.deps import ERROR_RESPONSES, DbSession, Pagination, SearchQuery
from app.schemas.clients import ClientCreate, ClientOut, ClientUpdate
from app.schemas.common import DataResponse, PaginatedResponse, PaginationMeta
from app.security import AdminUser, AuthenticatedUser
from app.services.clients import ClientService

router = APIRouter(prefix="/clients", tags=["Clients"], responses=ERROR_RESPONSES)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=DataResponse[ClientOut],
    responses={409: {"description": "Identification number already registered"}},
)
def create_client(body: ClientCreate, db: DbSession, _: AuthenticatedUser):
    return {"data": ClientService(db).create(body)}


@router.get("", response_model=PaginatedResponse[ClientOut])
def list_clients(
    db: DbSession,
    _: AuthenticatedUser,
    pagination: Pagination,
    search: SearchQuery = None,
    is_active: bool | None = None,
):
    items, total = ClientService(db).list(pagination, search, is_active)
    return {"data": items, "meta": PaginationMeta.build(pagination, total)}


@router.get("/{client_id}", response_model=DataResponse[ClientOut])
def get_client(client_id: uuid.UUID, db: DbSession, _: AuthenticatedUser):
    return {"data": ClientService(db).get(client_id)}


@router.patch("/{client_id}", response_model=DataResponse[ClientOut])
def update_client(client_id: uuid.UUID, body: ClientUpdate, db: DbSession, _: AuthenticatedUser):
    return {"data": ClientService(db).update(client_id, body)}


@router.delete(
    "/{client_id}",
    response_model=DataResponse[ClientOut],
    summary="Deactivate client (admin only, soft delete)",
)
def deactivate_client(client_id: uuid.UUID, db: DbSession, _: AdminUser):
    return {"data": ClientService(db).deactivate(client_id)}
