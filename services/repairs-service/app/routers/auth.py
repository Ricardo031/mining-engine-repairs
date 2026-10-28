from fastapi import APIRouter, Depends

from app.security import verify_token

router = APIRouter()


@router.get("/auth/me")
def auth_me(current_user: dict = Depends(verify_token)) -> dict:
    """Protected endpoint: the JWT must be valid (signed by the auth service)."""
    return {"data": current_user}
