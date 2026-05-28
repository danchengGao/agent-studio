from connect.client.auth.token_storage import (
    get_user_token,
    remove_user_token,
)
from connect.client.auth.verify_token import verify_token as api_verify_token
from connect.client import OpenJiuwenClient
from ...state import get_user_data, get_app_config


def handle_login(ack, respond, command):
    ack()
    user_id = command['user_id']
    config = get_app_config()
    backend_url = config.get('backend_url', 'http://localhost:8000')

    token = get_user_token(user_id)
    if token:
        client = OpenJiuwenClient(base_url=backend_url)
        client.set_token(token)
        try:
            api_verify_token(client)
            respond("✅ Already logged in. Use `/logout` to sign out.")
            return
        except Exception:
            remove_user_token(user_id)

    user_data = get_user_data(user_id)
    user_data['state'] = 'login_username'

    if config.get('enable_password_login', False):
        respond("🔐 *Login to OpenJiuwen Backend*\n\nReply with your username (email):")
    else:
        respond("🔐 *Login to OpenJiuwen Backend*\n\nReply with your username (email):\n_No password required._")
