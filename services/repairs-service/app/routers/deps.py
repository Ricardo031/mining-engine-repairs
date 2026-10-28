from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import PaginationParams

DbSession = Annotated[Session, Depends(get_db)]


def get_pagination(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginationParams:
    return PaginationParams(page=page, limit=limit)


Pagination = Annotated[PaginationParams, Depends(get_pagination)]
SearchQuery = Annotated[str | None, Query(min_length=1, max_length=100)]

# Standard error responses shown in the OpenAPI docs.
ERROR_RESPONSES = {
    400: {"description": "Validation error"},
    401: {"description": "Missing, invalid or expired token"},
    403: {"description": "Insufficient role"},
}
