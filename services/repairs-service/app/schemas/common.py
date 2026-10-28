import math
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

T = TypeVar("T")

# Trimmed text types (whitespace is stripped before checking lengths).
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
PowerText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
NameText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
IdentificationNumber = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=3, max_length=30, pattern=r"^[A-Za-z0-9-]+$", to_upper=True
    ),
]
SerialNumber = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=60, to_upper=True)
]
NoteText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class InputModel(BaseModel):
    """Base for request bodies: unknown fields are rejected."""

    model_config = ConfigDict(extra="forbid")


class OutputModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


class PaginationMeta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int

    @classmethod
    def build(cls, params: PaginationParams, total: int) -> "PaginationMeta":
        return cls(
            page=params.page,
            limit=params.limit,
            total=total,
            total_pages=math.ceil(total / params.limit) if total else 0,
        )


class DataResponse(BaseModel, Generic[T]):
    data: T


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    meta: PaginationMeta
