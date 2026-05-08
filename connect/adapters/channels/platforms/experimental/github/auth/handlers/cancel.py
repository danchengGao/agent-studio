"""Cancel any active multi-turn operation."""
from ...state import get_user_data


async def handle_cancel(user_id: str, text: str, say) -> None:
    ud = get_user_data(user_id)
    cleared = False
    for key in ("state", "pending_username", "workflow_session", "agent_chat"):
        if key in ud:
            del ud[key]
            cleared = True
    await say("Cancelled." if cleared else "Nothing to cancel.")
