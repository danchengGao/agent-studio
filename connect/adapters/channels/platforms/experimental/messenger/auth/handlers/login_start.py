"""Handle the 'login' command — start the login flow."""
from connect.client.config import ENABLE_PASSWORD_LOGIN
from ..._state_helpers import set_state


async def handle(user_id: str, say, user_data: dict) -> None:
    from connect.client.auth.token_storage import get_user_token
    if get_user_token(user_id):
        await say("You are already logged in. Send 'logout' to log out first.")
        return
    if not ENABLE_PASSWORD_LOGIN:
        await say(
            "Password login is disabled.\n"
            "Contact your administrator to obtain an access token."
        )
        return
    set_state(user_data, 'login_username')
    await say("Please enter your username:")
