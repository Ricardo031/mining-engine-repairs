import uuid

from fastapi import APIRouter, status

from app.routers.deps import ERROR_RESPONSES, DbSession, Pagination, SearchQuery
from app.schemas.common import DataResponse, PaginatedResponse, PaginationMeta
from app.schemas.engines import EngineCreate, EngineOut, EngineUpdate
from app.security import AdminUser, AuthenticatedUser
from app.services.engines import EngineService

router = APIRouter(prefix="/engines", tags=["Engines"], responses=ERROR_RESPONSES)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=DataResponse[EngineOut],
    responses={
        404: {"description": "Client not found"},
        409: {"description": "Serial number already registered"},
        422: {"description": "Client is inactive"},
    },
)
def create_engine(body: EngineCreate, db: DbSession, _: AuthenticatedUser):
    return {"data": EngineService(db).create(body)}


@router.get("", response_model=PaginatedResponse[EngineOut])
def list_engines(
    db: DbSession,
    _: AuthenticatedUser,
    pagination: Pagination,
    search: SearchQuery = None,
    client_id: uuid.UUID | None = None,
    is_active: bool | None = None,
):
    items, total = EngineService(db).list(pagination, search, client_id, is_active)
    return {"data": items, "meta": PaginationMeta.build(pagination, total)}


@router.get("/{engine_id}", response_model=DataResponse[EngineOut])
def get_engine(engine_id: uuid.UUID, db: DbSession, _: AuthenticatedUser):
    return {"data": EngineService(db).get(engine_id)}


@router.patch("/{engine_id}", response_model=DataResponse[EngineOut])
def update_engine(engine_id: uuid.UUID, body: EngineUpdate, db: DbSession, _: AuthenticatedUser):
    return {"data": EngineService(db).update(engine_id, body)}


@router.delete(
    "/{engine_id}",
    response_model=DataResponse[EngineOut],
    summary="Deactivate engine (admin only, soft delete)",
)
def deactivate_engine(engine_id: uuid.UUID, db: DbSession, _: AdminUser):
    return {"data": EngineService(db).deactivate(engine_id)}
