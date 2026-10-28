"""The service must verify signature, expiration and claims, not just decode the token."""

import time

import pytest

from tests.conftest import PUBLIC_KEY, _generate_key_pair

ME = "/api/v1/auth/me"


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_health_is_public(http):
    response = http.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "up"


def test_valid_token_is_accepted(http, make_token):
    response = http.get(ME, headers=bearer(make_token("admin", email="boss@mining.local")))
    assert response.status_code == 200
    assert response.json()["data"] == {
        "id": response.json()["data"]["id"],
        "email": "boss@mining.local",
        "role": "admin",
    }


def test_missing_token_returns_401(http):
    response = http.get(ME)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    assert response.headers["www-authenticate"] == "Bearer"


def test_expired_token_returns_token_expired(http, make_token):
    past = int(time.time()) - 7200
    token = make_token(iat=past, exp=past + 60)
    response = http.get(ME, headers=bearer(token))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_EXPIRED"


def test_token_signed_with_another_key_is_rejected(http, make_token):
    other_private_key, _ = _generate_key_pair()
    response = http.get(ME, headers=bearer(make_token(key=other_private_key)))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


def test_tampered_payload_is_rejected(http, make_token):
    """Changing the role inside the payload breaks the signature."""
    header, _, signature = make_token("operator").split(".")
    forged_payload = make_token("admin").split(".")[1]
    response = http.get(ME, headers=bearer(f"{header}.{forged_payload}.{signature}"))
    assert response.status_code == 401


def test_hs256_with_public_key_as_secret_is_rejected(http, make_token):
    """Algorithm confusion attack: only RS256 is accepted."""
    import base64
    import hashlib
    import hmac
    import json

    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    now = int(time.time())
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(
        json.dumps(
            {
                "sub": "x",
                "email": "a@b.co",
                "role": "admin",
                "type": "access",
                "iss": "mining-repairs-auth",
                "aud": "mining-repairs-api",
                "iat": now,
                "exp": now + 600,
            }
        ).encode()
    )
    signature = b64(hmac.new(PUBLIC_KEY, f"{header}.{body}".encode(), hashlib.sha256).digest())
    response = http.get(ME, headers=bearer(f"{header}.{body}.{signature}"))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


def test_unsigned_token_is_rejected(http):
    token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ4Iiwicm9sZSI6ImFkbWluIn0."
    assert http.get(ME, headers=bearer(token)).status_code == 401


@pytest.mark.parametrize(
    "claims",
    [
        {"iss": "someone-else"},
        {"aud": "another-api"},
        {"type": "refresh"},
        {"role": "superuser"},
        {"sub": None},
        {"exp": None},
    ],
    ids=["issuer", "audience", "type", "role", "missing-sub", "missing-exp"],
)
def test_invalid_claims_are_rejected(http, make_token, claims):
    response = http.get(ME, headers=bearer(make_token(**claims)))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


def test_garbage_token_is_rejected(http):
    response = http.get(ME, headers=bearer("not-a-jwt"))
    assert response.status_code == 401


def test_protected_endpoints_require_token(http):
    for path in ("/api/v1/clients", "/api/v1/engines", "/api/v1/orders", "/api/v1/orders/summary"):
        assert http.get(path).status_code == 401, path
