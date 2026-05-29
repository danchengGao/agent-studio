from ...client_session import get_backend_client
from ...state import get_user_data


def handle_chat_end(ack, respond, command):
    ack()
    user_id = command['user_id']
    user_data = get_user_data(user_id)
    user_data.pop('agent_chat', None)
    user_data['state'] = 'idle'
    respond("👋 Chat session ended. Use `/agent_chat <id>` to start a new one.")
