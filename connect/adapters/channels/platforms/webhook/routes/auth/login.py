"""Login endpoint — exchange username/password for token + space_id."""
from connect.client import OpenJiuwenClient
from connect.client.auth.do_login import do_login
from ...auth import get_backend_url, set_credentials
from .models import LoginRequest


def auth_login(body: LoginRequest):
    """Authenticate with the OpenJiuwen backend.

    On success the returned `token` and `space_id` are **automatically applied**
    to all subsequent requests in this Swagger session — no manual copy-paste needed.
    """
    client = OpenJiuwenClient(base_url=get_backend_url())
    try:
        result = do_login(client, body.username, body.password)
        set_credentials(result["token"], result.get("space_id"))
        return {
            "success": True,
            "token": result["token"],
            "space_id": result.get("space_id"),
            "refresh_token": result.get("refresh_token"),
            "error": None,
        }
    except Exception as e:
        return {
            "success": False,
            "token": None,
            "space_id": None,
            "refresh_token": None,
            "error": str(e),
        }
