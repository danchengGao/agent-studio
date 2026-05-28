from connect.client.config import ENABLE_PASSWORD_LOGIN
from ..._state_helpers import set_state


async def handle(user_id: str, say, user_data: dict) -> None:
    from connect.client.auth.token_storage import get_user_token
    if get_user_token(user_id):
        await say("You are already logged in. Say logout to log out first.")
        return
    if not ENABLE_PASSWORD_LOGIN:
        await say("Password login is disabled. Contact your administrator.")
        return
    set_state(user_data, 'login_username')
    await say("Please say your username.")
