"""Start an agent chat session."""
from ...state import get_user_data


async def handle_agent_start_chat(user_id: str, agent_id: str, say) -> None:
    if not agent_id:
        await say("Usage: `/agent chat <agent_id>`")
        return
    ud = get_user_data(user_id)
    ud["agent_chat"] = {"agent_id": agent_id, "conversation_id": ""}
    await say(
        f"Chat started with agent `{agent_id}`. "
        "Comment any message to continue."
    )
