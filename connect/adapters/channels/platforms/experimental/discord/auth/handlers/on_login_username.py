"""DM router step — collects username during login flow."""
from ...state import get_user_data, get_app_config
from ._do_login import _do_login


async def on_login_username(user_id: str, username: str, say) -> None:
    """Called from the DM message router when state == 'login_username'."""
    user_data = get_user_data(user_id)
    user_data['login_username'] = username
    config = get_app_config()

    if config.get('enable_password_login', False):
        user_data['state'] = 'login_password'
        await say(f"Username: `{username}`\n\nNow reply with your password:")
    else:
        await _do_login(user_id, username, '', say, user_data)
