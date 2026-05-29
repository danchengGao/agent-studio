"""Show login status."""
from connect.client.auth.token_storage import get_user_token
from connect.client.auth.verify_token import verify_token
from connect.client import OpenJiuwenClient
from ...state import get_app_config


async def handle_status(user_id: str, text: str, say) -> None:
    token_data = get_user_token(user_id)
    if not token_data:
        await say("Not logged in. Send: login")
        return
    config = get_app_config()
    client = OpenJiuwenClient(base_url=config["backend_url"])
    client.set_token(token_data["token"])
    client.space_id = token_data.get("space_id", "")
    try:
        import asyncio
        valid = await asyncio.get_event_loop().run_in_executor(None, lambda: verify_token(client))
        status = "active" if valid else "expired"
    except Exception:
        status = "unknown"
    await say(f"Logged in as user {user_id}. Token: {status}.")
