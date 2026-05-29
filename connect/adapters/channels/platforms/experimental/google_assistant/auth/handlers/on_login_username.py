from ...state import get_app_config
from ._do_login import _do_login


async def on_login_username(user_id: str, username: str, say, user_data: dict) -> None:
    user_data["login_username"] = username
    if get_app_config().get("enable_password_login", False):
        user_data["state"] = "login_password"
        await say(f"Username {username} received. Now please say your password.")
    else:
        await _do_login(user_id, username, "", say, user_data)
