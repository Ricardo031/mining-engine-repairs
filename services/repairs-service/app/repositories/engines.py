import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Engine
from app.repositories.base import escape_like, paginate


class EngineRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, engine_id: uuid.UUID) -> Engine | None:
        return self.db.get(Engine, engine_id)

    def get_by_serial_number(self, serial_number: str) -> Engine | None:
        return self.db.scalar(select(Engine).where(func.upper(Engine.serial_number) == serial_number.upper()))

    def list(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None = None,
        client_id: uuid.UUID | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[Engine], int]:
        query = select(Engine)
        if search:
            pattern = f"%{escape_like(search)}%"
            query = query.where(
                or_(
                    Engine.serial_number.ilike(pattern, escape="\\"),
                    Engine.manufacturer.ilike(pattern, escape="\\"),
                    Engine.model.ilike(pattern, escape="\\"),
                )
            )
        if client_id is not None:
            query = query.where(Engine.client_id == client_id)
        if is_active is not None:
            query = query.where(Engine.is_active == is_active)
        return paginate(self.db, query.order_by(Engine.registered_at.desc()), offset, limit)

    def add(self, engine: Engine) -> Engine:
        self.db.add(engine)
        self.db.flush()
        return engine
