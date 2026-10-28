import uuid

from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.models import Engine
from app.repositories.engines import EngineRepository
from app.schemas.common import PaginationParams
from app.schemas.engines import EngineCreate, EngineUpdate
from app.services.clients import ClientService


class EngineService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.engines = EngineRepository(db)
        self.clients = ClientService(db)

    def create(self, data: EngineCreate) -> Engine:
        self._ensure_serial_is_free(data.serial_number)
        self._ensure_active_client(data.client_id)

        engine = self.engines.add(Engine(**data.model_dump(), is_active=True))
        self.db.commit()
        self.db.refresh(engine)
        return engine

    def list(
        self,
        pagination: PaginationParams,
        search: str | None,
        client_id: uuid.UUID | None,
        is_active: bool | None,
    ) -> tuple[list[Engine], int]:
        return self.engines.list(
            offset=pagination.offset,
            limit=pagination.limit,
            search=search,
            client_id=client_id,
            is_active=is_active,
        )

    def get(self, engine_id: uuid.UUID) -> Engine:
        engine = self.engines.get(engine_id)
        if engine is None:
            raise NotFoundError("Engine not found")
        return engine

    def update(self, engine_id: uuid.UUID, data: EngineUpdate) -> Engine:
        engine = self.get(engine_id)
        changes = data.model_dump(exclude_unset=True, exclude_none=True)

        new_serial = changes.get("serial_number")
        if new_serial and new_serial != engine.serial_number:
            self._ensure_serial_is_free(new_serial)

        new_client = changes.get("client_id")
        if new_client and new_client != engine.client_id:
            self._ensure_active_client(new_client)

        for field, value in changes.items():
            setattr(engine, field, value)
        self.db.commit()
        self.db.refresh(engine)
        return engine

    def deactivate(self, engine_id: uuid.UUID) -> Engine:
        engine = self.get(engine_id)
        engine.is_active = False
        self.db.commit()
        self.db.refresh(engine)
        return engine

    def _ensure_serial_is_free(self, serial_number: str) -> None:
        if self.engines.get_by_serial_number(serial_number):
            raise ConflictError(f"An engine with serial number '{serial_number}' already exists")

    def _ensure_active_client(self, client_id: uuid.UUID) -> None:
        client = self.clients.get(client_id)
        if not client.is_active:
            raise BusinessRuleError("Engines can only be assigned to active clients")
