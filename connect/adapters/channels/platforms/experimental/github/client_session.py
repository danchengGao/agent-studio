"""Auth helper for the GitHub platform."""
from connect.client.auth.token_storage import get_user_token
from connect.client.auth.token_manager import verify_and_refresh
from connect.client import OpenJiuwenClient
from .state import get_app_config


async def get_backend_client(user_id: str, say):
    """Return (client, None) or (None, error_string)."""
    config = get_app_config()
    if config.get("static_token"):
        client = OpenJiuwenClient(base_url=config["backend_url"])
        client.set_token(config["static_token"])
        client.space_id = config.get("space_id", "")
        return client, None

    token_data = get_user_token(user_id)
    if not token_data:
        await say("Please log in first. Comment `/login` to start.")
        return None, "not_logged_in"

    client = OpenJiuwenClient(base_url=config["backend_url"])
    client.set_token(token_data["token"])
    client.space_id = token_data.get("space_id", "")

    ok, new_token = verify_and_refresh(client, user_id, token_data.get("refresh_token"))
    if not ok:
        await say("Session expired. Comment `/login` to log in again.")
        return None, "session_expired"
    if new_token:
        client.set_token(new_token)
        from connect.client.auth.token_storage.set_user_data import set_user_data
        set_user_data(user_id, new_token, client.space_id, token_data.get("refresh_token", ""))
    return client, None
