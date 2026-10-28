"""Environment-based configuration for the repairs service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="REPAIRS_",
        extra="ignore",
    )

    app_name: str = "mining-repairs-business-api"
    environment: str = "development"

    # PostgreSQL (repairs_db is owned exclusively by this service)
    database_url: str = (
        "postgresql+psycopg://repairs_user:change_me_repairs@localhost:5432/repairs_db"
    )

    # JWT public key (the auth service signs with the private key)
    jwt_public_key_path: str = "../../keys/jwt-public.pem"
    jwt_algorithm: str = "RS256"
    jwt_issuer: str = "mining-repairs-auth"
    jwt_audience: str = "mining-repairs-api"

    debug: bool = False


settings = Settings()
