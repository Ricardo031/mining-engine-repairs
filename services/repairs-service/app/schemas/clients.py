import uuid
from datetime import datetime

from pydantic import EmailStr, Field, model_validator

from app.models import IdentificationType
from app.schemas.common import IdentificationNumber, InputModel, NameText, OutputModel


class ClientCreate(InputModel):
    name: NameText
    identification_type: IdentificationType
    identification_number: IdentificationNumber = Field(description="Letters, digits and dashes only")
    email: EmailStr


class ClientUpdate(InputModel):
    name: NameText | None = None
    identification_type: IdentificationType | None = None
    identification_number: IdentificationNumber | None = None
    email: EmailStr | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "ClientUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class ClientSummary(OutputModel):
    id: uuid.UUID
    name: str
    identification_type: IdentificationType
    identification_number: str


class ClientOut(ClientSummary):
    email: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
