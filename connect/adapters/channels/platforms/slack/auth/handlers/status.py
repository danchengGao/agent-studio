from connect.client.auth.token_storage import get_user_token, remove_user_token
from connect.client import OpenJiuwenClient
from connect.client.auth.verify_token import verify_token as api_verify_token
from ...state import get_app_config


def handle_status(ack, respond, command):
    ack()
    user_id = command['user_id']
    token = get_user_token(user_id)
    if not token:
        respond("❌ Not logged in. Use `/login` to authenticate.")
        return
    backend_url = get_app_config().get('backend_url', 'http://localhost:8000')
    client = OpenJiuwenClient(base_url=backend_url)
    client.set_token(token)
    try:
        api_verify_token(client)
        respond("✅ *Logged in* — token is valid.\nUse `/logout` to sign out.")
    except Exception:
        respond("❌ Token expired. Please `/login` again.")
        remove_user_token(user_id)
