"""Test setup.

* Runs against a real PostgreSQL database (repairs_db_test), rebuilt with the
  Alembic migrations, so tests exercise the same schema as production.
* Generates a throwaway RSA key pair: tests sign tokens with the private key,
  exactly like the auth service would, and the app verifies them with the
  public key.
"""

import os
import tempfile
import time
import uuid
from collections.abc import Callable, Iterator
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

TEST_DATABASE_URL = os.environ.get(
    "REPAIRS_TEST_DATABASE_URL",
    "postgresql+psycopg://repairs_user:change_me_repairs@localhost:5433/repairs_db_test",
)
ISSUER = "mining-repairs-auth"
AUDIENCE = "mining-repairs-api"


def _generate_key_pair() -> tuple[bytes, bytes]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return private_pem, public_pem


PRIVATE_KEY, PUBLIC_KEY = _generate_key_pair()
_keys_dir = Path(tempfile.mkdtemp(prefix="repairs-test-keys-"))
(_keys_dir / "jwt-public.pem").write_bytes(PUBLIC_KEY)

# Must be set before any `app.*` import reads the settings.
os.environ.update(
    {
        "REPAIRS_ENVIRONMENT": "test",
        "REPAIRS_DATABASE_URL": TEST_DATABASE_URL,
        "REPAIRS_JWT_PUBLIC_KEY_PATH": str(_keys_dir / "jwt-public.pem"),
        "REPAIRS_JWT_ISSUER": ISSUER,
        "REPAIRS_JWT_AUDIENCE": AUDIENCE,
        "REPAIRS_LOG_SQL": "false",
    }
)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402

SERVICE_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    config = Config(str(SERVICE_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(SERVICE_ROOT / "alembic"))
    config.attributes["database_url"] = TEST_DATABASE_URL
    command.upgrade(config, "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables() -> Iterator[None]:
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE order_status_history, repair_orders, engines, clients CASCADE"))
        conn.execute(text("ALTER SEQUENCE repair_order_number_seq RESTART WITH 1"))


@pytest.fixture(scope="session")
def http() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


TokenFactory = Callable[..., str]


@pytest.fixture(scope="session")
def make_token() -> TokenFactory:
    def factory(
        role: str = "operator", *, key: bytes = PRIVATE_KEY, algorithm: str = "RS256", **claims
    ) -> str:
        now = int(time.time())
        payload = {
            "sub": str(uuid.uuid4()),
            "email": f"{role}@mining-repairs.local",
            "role": role,
            "type": "access",
            "iss": ISSUER,
            "aud": AUDIENCE,
            "iat": now,
            "exp": now + 3600,
            "jti": str(uuid.uuid4()),
        }
        payload.update(claims)
        payload = {k: v for k, v in payload.items() if v is not None}
        return jwt.encode(payload, key, algorithm=algorithm)

    return factory


@pytest.fixture(scope="session")
def operator_headers(make_token: TokenFactory) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token('operator')}"}


@pytest.fixture(scope="session")
def admin_headers(make_token: TokenFactory) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token('admin')}"}


# --- Helpers to create data through the API ---------------------------------


@pytest.fixture
def create_client(http: TestClient, operator_headers):
    def factory(**overrides) -> dict:
        body = {
            "name": "Minera del Norte S.A.",
            "identification_type": "NIT",
            "identification_number": f"900{uuid.uuid4().int % 10**7:07d}",
            "email": "contacto@mineranorte.co",
            **overrides,
        }
        response = http.post("/api/v1/clients", json=body, headers=operator_headers)
        assert response.status_code == 201, response.text
        return response.json()["data"]

    return factory


@pytest.fixture
def create_engine(http: TestClient, operator_headers, create_client):
    def factory(**overrides) -> dict:
        client_id = overrides.pop("client_id", None) or create_client()["id"]
        body = {
            "serial_number": f"CAT-{uuid.uuid4().hex[:8]}",
            "manufacturer": "Caterpillar",
            "model": "C175-16",
            "engine_type": "Diesel V16",
            "power": "2800 HP",
            "client_id": client_id,
            **overrides,
        }
        response = http.post("/api/v1/engines", json=body, headers=operator_headers)
        assert response.status_code == 201, response.text
        return response.json()["data"]

    return factory


@pytest.fixture
def create_order(http: TestClient, operator_headers, create_engine):
    def factory(**overrides) -> dict:
        engine_id = overrides.pop("engine_id", None) or create_engine()["id"]
        body = {
            "engine_id": engine_id,
            "received_at": "2026-10-01",
            "reported_problem": "Loss of power and black smoke under load",
            "technician": "Carlos Pérez",
            "estimated_delivery_date": "2026-10-20",
            **overrides,
        }
        response = http.post("/api/v1/orders", json=body, headers=operator_headers)
        assert response.status_code == 201, response.text
        return response.json()["data"]

    return factory
