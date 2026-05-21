"""Start agent chat command handler — opens an interactive chat session."""
from ...client_session import get_backend_client


async def handle_chat_start(user_id: str, say, user_data: dict, agent_id: str = "") -> None:
    if not agent_id:
        await say("Usage: agent chat <agent-id>")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    user_data["agent_chat"] = {"agent_id": agent_id, "conversation_id": ""}
    user_data["state"] = "agent_chat"
    await say(
        f"Started chat with agent: {agent_id}\n"
        "Reply to this email with your messages to chat."
    )
