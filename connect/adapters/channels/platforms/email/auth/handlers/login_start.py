"""Login command handler — initiates the multi-step login flow."""

from connect.client.auth.token_storage import get_user_token, remove_user_token
from connect.client.auth.verify_token import verify_token as api_verify_token
from connect.client import OpenJiuwenClient
from ...state import get_app_config


async def handle_login(user_id: str, say, user_data: dict) -> None:
    config = get_app_config()
    backend_url = config.get("backend_url", "http://localhost:8000")

    token = get_user_token(user_id)
    if token:
        client = OpenJiuwenClient(base_url=backend_url)
        client.set_token(token)
        try:
            api_verify_token(client)
            await say("Already logged in. Reply with: logout  — to sign out.")
            return
        except Exception:
            remove_user_token(user_id)

    user_data["state"] = "login_username"
    prompt = "Login to OpenJiuwen Backend\n\nReply with your username (email address):"
    if not config.get("enable_password_login", False):
        prompt += "\n(No password required — just send your username.)"
    await say(prompt)
