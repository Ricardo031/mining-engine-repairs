import uuid
from datetime import datetime

from pydantic import Field, model_validator

from app.schemas.clients import ClientSummary
from app.schemas.common import InputModel, OutputModel, PowerText, SerialNumber, ShortText


class EngineCreate(InputModel):
    serial_number: SerialNumber = Field(description="Internal code or serial number")
    manufacturer: ShortText
    model: ShortText
    engine_type: ShortText
    power: PowerText = Field(description="Power or capacity, free text (e.g. 2500 HP)")
    client_id: uuid.UUID


class EngineUpdate(InputModel):
    serial_number: SerialNumber | None = None
    manufacturer: ShortText | None = None
    model: ShortText | None = None
    engine_type: ShortText | None = None
    power: PowerText | None = None
    client_id: uuid.UUID | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "EngineUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class EngineSummary(OutputModel):
    id: uuid.UUID
    serial_number: str
    manufacturer: str
    model: str
    engine_type: str
    power: str


class EngineOut(EngineSummary):
    client: ClientSummary
    registered_at: datetime
    is_active: bool
    created_at: datetime
    updated_at: datetime
