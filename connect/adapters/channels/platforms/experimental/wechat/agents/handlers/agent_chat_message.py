from openjiuwen.core.common.logging import logger

from ....wechat.client_session import get_backend_client
from ..._state_helpers import set_state


async def handle(user_id: str, text: str, say, user_data: dict) -> None:
    agent = user_data.get('active_agent')
    if agent is None:
        set_state(user_data, 'idle')
        await say("No active agent session.")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        session_id = user_data.get('agent_session_id')
        result = client.chat_with_agent(
            agent_id=agent.get('id'),
            message=text,
            session_id=session_id,
        )
        reply = result.get('reply') or result.get('output') or str(result)
        new_session_id = result.get('session_id')
        if new_session_id:
            user_data['agent_session_id'] = new_session_id
        await say(reply)
    except Exception as e:
        logger.error("Agent chat error: %s", e)
        await say(f"Agent error: {e}")
