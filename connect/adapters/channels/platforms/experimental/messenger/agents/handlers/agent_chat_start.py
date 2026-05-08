"""Handle the 'agent run <name>' command — start an agent chat session."""
from ....messenger.client_session import get_backend_client
from ..._state_helpers import set_state


async def handle(user_id: str, name: str, say, user_data: dict) -> None:
    if not name:
        await say("Usage: agent run <name>")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        agents = client.list_agents()
        match = next((a for a in agents if a.get('name', '').lower() == name.lower()), None)
        if not match:
            await say(f"Agent '{name}' not found. Send 'agents' to see available agents.")
            return
        user_data['active_agent'] = match
        user_data['agent_session_id'] = None
        set_state(user_data, 'agent_chat')
        await say(
            f"Started chat with agent '{name}'.\n"
            "Send your messages and the agent will respond.\n"
            "Send 'agent end' to end the session."
        )
    except Exception as e:
        await say(f"Failed to start agent: {e}")
