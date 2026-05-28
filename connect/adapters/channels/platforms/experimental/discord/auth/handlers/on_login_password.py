"""DM router step — collects password during login flow."""
from ...state import get_user_data
from ._do_login import _do_login


async def on_login_password(user_id: str, password: str, say) -> None:
    """Called from the DM message router when state == 'login_password'."""
    user_data = get_user_data(user_id)
    username = user_data.get('login_username', '')
    await _do_login(user_id, username, password, say, user_data)
