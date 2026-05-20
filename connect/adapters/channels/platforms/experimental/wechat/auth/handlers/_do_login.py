from openjiuwen.core.common.logging import logger


from connect.client import OpenJiuwenClient
from connect.client.auth.token_storage import save_user_token, save_user_space_id, save_user_refresh_token
from ...state import get_app_config


async def do_login(user_id: str, username: str, password: str, say, user_data: dict) -> None:
    backend_url = get_app_config().get('backend_url', 'http://localhost:8000')
    client = OpenJiuwenClient(base_url=backend_url)
    try:
        result = client.login(username=username, password=password)
        token = result.get('access_token') or result.get('token', '')
        refresh_token = result.get('refresh_token', '')
        space_id = result.get('space_id', '')
        if not token:
            await say("Login failed: no token received.")
            return
        save_user_token(user_id, token)
        save_user_refresh_token(user_id, refresh_token)
        save_user_space_id(user_id, space_id)
        user_data['backend_client'] = client
        await say("Logged in successfully. Send 'help' to see available commands.")
    except Exception as e:
        logger.error("Login error for %s: %s", user_id, e)
        await say(f"Login failed: {e}")
