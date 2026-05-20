from ..._state_helpers import set_state


async def handle(user_id: str, say, user_data: dict) -> None:
    user_data.pop('active_agent', None)
    user_data.pop('agent_session_id', None)
    set_state(user_data, 'idle')
    await say("Agent session ended.")
