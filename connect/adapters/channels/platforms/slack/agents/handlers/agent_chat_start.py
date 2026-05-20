from ...client_session import get_backend_client
from ...state import get_user_data


def handle_chat_start(ack, respond, command):
    ack()
    user_id = command['user_id']
    agent_id = (command.get('text') or '').strip()
    if not agent_id:
        respond("❌ Usage: `/agent_chat <agent_id>`")
        return
    client = get_backend_client(user_id, respond)
    if not client:
        return
    user_data = get_user_data(user_id)
    user_data['agent_chat'] = {'agent_id': agent_id, 'conversation_id': ''}
    user_data['state'] = 'agent_chat'
    respond(
        f"🤖 Started chat with agent `{agent_id}`.\n"
        f"Reply here to send messages. Use `/agent_end_chat` to finish."
    )
