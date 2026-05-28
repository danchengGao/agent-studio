"""Auth routes package."""
from fastapi import APIRouter

from .login import auth_login
from .models import LoginRequest

router = APIRouter(prefix="/auth", tags=["Auth"])

# Login is intentionally unprotected — it IS the way to get credentials
router.add_api_route(
    "/login",
    auth_login,
    methods=["POST"],
    summary="Login with username and password",
)

__all__ = ["router", "LoginRequest", "auth_login"]
