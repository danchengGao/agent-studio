"""Handle a message within an active agent chat."""
import asyncio
from connect.client.agents import execute_agent
from connect.client.agents import parse_agent_response
from ...client_session import get_backend_client
from ...state import get_user_data


async def handle_agent_chat_message(user_id: str, text: str, say) -> None:
    ud = get_user_data(user_id)
    chat = ud.get("agent_chat", {})
    agent_id = chat.get("agent_id", "")
    conv_id = chat.get("conversation_id", "")
    if not agent_id:
        await say("No active chat. Comment `/agent start <agent_id>`.")
        return
    client, err = await get_backend_client(user_id, say)
    if err:
        return
    try:
        events = await asyncio.get_event_loop().run_in_executor(
            None, lambda: execute_agent(client, agent_id, text, conv_id)
        )
        reply, new_conv_id, error = parse_agent_response(events)
    except Exception as exc:
        await say(f"Error: {exc}")
        return
    if new_conv_id:
        ud["agent_chat"]["conversation_id"] = new_conv_id
    await say(error if error else (reply or "No response."))
