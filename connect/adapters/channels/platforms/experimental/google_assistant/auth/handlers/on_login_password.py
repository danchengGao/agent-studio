from ._do_login import _do_login


async def on_login_password(user_id: str, password: str, say, user_data: dict) -> None:
    username = user_data.get("login_username", "")
    await _do_login(user_id, username, password, say, user_data)
