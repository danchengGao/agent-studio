"""Status command handler — shows current login state."""
from connect.client.auth.token_storage import get_user_token, remove_user_token
from connect.client.auth.verify_token import verify_token as api_verify_token
from connect.client import OpenJiuwenClient
from ...state import get_app_config


async def handle_status(user_id: str, say, user_data: dict) -> None:
    token = get_user_token(user_id)
    if not token:
        await say("Not logged in. Reply with: login  — to authenticate.")
        return
    backend_url = get_app_config().get("backend_url", "http://localhost:8000")
    client = OpenJiuwenClient(base_url=backend_url)
    client.set_token(token)
    try:
        api_verify_token(client)
        await say("Logged in — token is valid.\nReply with: logout  — to sign out.")
    except Exception:
        remove_user_token(user_id)
        await say("Token expired. Reply with: login  — to authenticate again.")
