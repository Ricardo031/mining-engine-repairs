import uuid

from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models import Client
from app.repositories.clients import ClientRepository
from app.schemas.clients import ClientCreate, ClientUpdate
from app.schemas.common import PaginationParams


class ClientService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.clients = ClientRepository(db)

    def create(self, data: ClientCreate) -> Client:
        self._ensure_identification_is_free(data.identification_number)
        client = self.clients.add(Client(**data.model_dump(), is_active=True))
        self.db.commit()
        return client

    def list(
        self, pagination: PaginationParams, search: str | None, is_active: bool | None
    ) -> tuple[list[Client], int]:
        return self.clients.list(
            offset=pagination.offset, limit=pagination.limit, search=search, is_active=is_active
        )

    def get(self, client_id: uuid.UUID) -> Client:
        client = self.clients.get(client_id)
        if client is None:
            raise NotFoundError("Client not found")
        return client

    def update(self, client_id: uuid.UUID, data: ClientUpdate) -> Client:
        client = self.get(client_id)
        changes = data.model_dump(exclude_unset=True, exclude_none=True)

        new_number = changes.get("identification_number")
        if new_number and new_number != client.identification_number:
            self._ensure_identification_is_free(new_number)

        for field, value in changes.items():
            setattr(client, field, value)
        self.db.commit()
        self.db.refresh(client)
        return client

    def deactivate(self, client_id: uuid.UUID) -> Client:
        """Soft delete: history (engines, orders) must stay consultable."""
        client = self.get(client_id)
        client.is_active = False
        self.db.commit()
        self.db.refresh(client)
        return client

    def _ensure_identification_is_free(self, number: str) -> None:
        if self.clients.get_by_identification_number(number):
            raise ConflictError(f"A client with identification number '{number}' already exists")
