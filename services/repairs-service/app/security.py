"""JWT validation for tokens issued by the auth service (RS256)."""

import datetime as dt

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


def _load_public_key():
    with open(settings.jwt_public_key_path, "r") as key_file:
        return key_file.read()


PUBLIC_KEY = _load_public_key()


def verify_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """Validates signature, expiration, issuer and audience of an access token."""
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Missing bearer token"}},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            key=PUBLIC_KEY,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={"require": ["exp", "iat", "sub", "role", "type", "email"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_TOKEN", "message": "Invalid access token"}},
        ) from exc

    return payload
