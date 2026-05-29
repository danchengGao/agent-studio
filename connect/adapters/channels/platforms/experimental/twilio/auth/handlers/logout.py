"""Log out the current user."""
from openjiuwen.core.common.logging import logger
from connect.client.auth.token_storage.set_user_data import clear_user_data
from ...state import get_user_data


async def handle_logout(user_id: str, text: str, say) -> None:
    ud = get_user_data(user_id)
    ud.clear()
    try:
        clear_user_data(user_id)
    except Exception as exc:
        logger.warning("Failed to clear stored user data for %s: %s", user_id, exc)
    await say("You have been logged out.")
