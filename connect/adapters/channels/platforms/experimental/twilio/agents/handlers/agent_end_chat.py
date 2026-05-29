"""End the active agent chat session."""
from ...state import get_user_data


async def handle_agent_end_chat(user_id: str, text: str, say) -> None:
    ud = get_user_data(user_id)
    if "agent_chat" in ud:
        del ud["agent_chat"]
        await say("Chat ended.")
    else:
        await say("No active chat session.")
