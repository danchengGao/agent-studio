"""Begin the login flow — ask for username."""
from ...state import get_user_data


async def handle_login_start(user_id: str, text: str, say) -> None:
    ud = get_user_data(user_id)
    ud["state"] = "awaiting_username"
    await say("Please reply with your OpenJiuwen username (email address).")
