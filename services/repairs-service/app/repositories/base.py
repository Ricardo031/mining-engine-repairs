from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


def escape_like(value: str) -> str:
    """Escapes LIKE wildcards so user input is matched literally."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def paginate(db: Session, query: Select, offset: int, limit: int) -> tuple[list, int]:
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    items = db.scalars(query.offset(offset).limit(limit)).unique().all()
    return list(items), total
