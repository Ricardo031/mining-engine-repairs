"""Environment-based configuration for the repairs service."""

from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All variables use the REPAIRS_ prefix (e.g. REPAIRS_DATABASE_URL)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="REPAIRS_",
        extra="ignore",
    )

    app_name: str = "mining-repairs-business-api"
    environment: str = "development"
    log_sql: bool = False

    # Comma separated list of allowed browser origins
    cors_origins: str = "http://localhost:5173"

    # PostgreSQL (repairs_db is owned exclusively by this service)
    database_url: str = "postgresql+psycopg://repairs_user:change_me_repairs@localhost:5433/repairs_db"

    # JWT validation. Only the PUBLIC key is needed: this service can verify
    # tokens but can never issue them.
    jwt_public_key_path: str = "../../keys/jwt-public.pem"
    jwt_algorithm: str = "RS256"
    jwt_issuer: str = "mining-repairs-auth"
    jwt_audience: str = "mining-repairs-api"

    @cached_property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
