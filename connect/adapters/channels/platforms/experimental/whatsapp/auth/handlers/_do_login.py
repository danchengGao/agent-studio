"""Client login business logic — shared by username and password steps."""
from connect.client.auth.do_login import do_login
from connect.client.auth.token_storage import set_user_data
from connect.client import OpenJiuwenClient
from ...state import get_app_config


async def _do_login(user_id: str, username: str, password: str, say, user_data: dict) -> None:
    backend_url = get_app_config().get('backend_url', 'http://localhost:8000')
    client = OpenJiuwenClient(base_url=backend_url)
    await say(f"🔐 Logging in as `{username}`...")
    try:
        result = do_login(client, username, password)
        set_user_data(user_id, result['token'], result['space_id'], result['refresh_token'])
        user_data.pop('login_username', None)
        user_data['state'] = 'idle'
        await say(
            f"✅ Logged in as `{username}`!\n"
            "Reply *help* to see all available commands."
        )
    except Exception as e:
        user_data['state'] = 'idle'
        await say(f"❌ Login failed: {e}\n\nReply *login* to try again.")
