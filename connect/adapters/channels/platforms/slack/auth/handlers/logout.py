from connect.client.auth.token_storage import get_user_token, remove_user_token
from ...state import get_user_data


def handle_logout(ack, respond, command):
    ack()
    user_id = command['user_id']
    if not get_user_token(user_id):
        respond("ℹ️ You are not logged in.")
        return
    remove_user_token(user_id)
    user_data = get_user_data(user_id)
    user_data.pop('backend_client', None)
    user_data['state'] = 'idle'
    respond("✅ Successfully logged out. Use `/login` to sign in again.")
