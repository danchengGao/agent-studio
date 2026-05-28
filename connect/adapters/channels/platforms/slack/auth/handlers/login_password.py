from ._do_login import _do_login
from ...state import get_user_data, get_app_config


def on_login_password(user_id: str, password: str, say) -> None:
    """Called from the message router when state == 'login_password'."""
    user_data = get_user_data(user_id)
    username = user_data.get('login_username', '')
    _do_login(user_id, username, password, say, user_data)
