"""JWT validation for tokens issued by the auth service.

The auth service signs tokens with its RSA private key (RS256). This service
only holds the public key, so it can verify tokens but never create them, and
it never sees user passwords.
"""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.core.errors import ForbiddenError, UnauthorizedError

Role = Literal["admin", "operator"]
VALID_ROLES: frozenset[str] = frozenset({"admin", "operator"})

bearer_scheme = HTTPBearer(auto_error=False, description="Access token issued by the auth service")


@dataclass(frozen=True)
class CurrentUser:
    """Identity taken from a verified token (the user lives in the auth service)."""

    id: str
    email: str
    role: Role


@lru_cache
def get_public_key() -> str:
    path = Path(settings.jwt_public_key_path)
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(
            f"Cannot read the JWT public key at '{path.resolve()}'. Set REPAIRS_JWT_PUBLIC_KEY_PATH."
        ) from exc


def decode_access_token(token: str) -> CurrentUser:
    """Verifies signature, expiration, issuer and audience; decoding alone is not enough."""
    try:
        payload = jwt.decode(
            token,
            key=get_public_key(),
            # A fixed list prevents algorithm confusion ("none", HS256 with the public key).
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Access token has expired", "TOKEN_EXPIRED") from exc
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid access token", "INVALID_TOKEN") from exc

    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type", "INVALID_TOKEN")

    role = payload.get("role")
    email = payload.get("email")
    if role not in VALID_ROLES or not isinstance(email, str):
        raise UnauthorizedError("Invalid access token payload", "INVALID_TOKEN")

    return CurrentUser(id=str(payload["sub"]), email=email, role=role)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Missing bearer token")
    return decode_access_token(credentials.credentials)


def require_roles(*roles: Role):
    """Dependency factory: only lets the given roles through."""

    def dependency(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in roles:
            raise ForbiddenError(f"This action requires one of the following roles: {', '.join(roles)}")
        return user

    return dependency


AuthenticatedUser = Annotated[CurrentUser, Depends(get_current_user)]
AdminUser = Annotated[CurrentUser, Depends(require_roles("admin"))]
