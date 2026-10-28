import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Client
from app.repositories.base import escape_like, paginate


class ClientRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, client_id: uuid.UUID) -> Client | None:
        return self.db.get(Client, client_id)

    def get_by_identification_number(self, number: str) -> Client | None:
        return self.db.scalar(
            select(Client).where(func.upper(Client.identification_number) == number.upper())
        )

    def list(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[Client], int]:
        query = select(Client)
        if search:
            pattern = f"%{escape_like(search)}%"
            query = query.where(
                or_(
                    Client.name.ilike(pattern, escape="\\"),
                    Client.identification_number.ilike(pattern, escape="\\"),
                    Client.email.ilike(pattern, escape="\\"),
                )
            )
        if is_active is not None:
            query = query.where(Client.is_active == is_active)
        return paginate(self.db, query.order_by(Client.name), offset, limit)

    def add(self, client: Client) -> Client:
        self.db.add(client)
        self.db.flush()
        return client
