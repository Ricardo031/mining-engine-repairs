from fastapi import APIRouter

from app.routers.deps import ERROR_RESPONSES
from app.security import AuthenticatedUser

router = APIRouter(prefix="/auth", tags=["Auth"], responses=ERROR_RESPONSES)


@router.get("/me")
def auth_me(user: AuthenticatedUser) -> dict:
    """Returns the identity read from a valid token signed by the auth service."""
    return {"data": {"id": user.id, "email": user.email, "role": user.role}}
