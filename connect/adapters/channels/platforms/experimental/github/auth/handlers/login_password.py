"""Receive password and complete login."""
from ...state import get_app_config, get_user_data


async def handle_login_password(user_id: str, text: str, say) -> None:
    ud = get_user_data(user_id)
    password = text.strip()
    username = ud.get("pending_username", "")
    if not username:
        ud.pop("state", None)
        await say("Session lost. Comment `/login` to start again.")
        return
    await _do_login(user_id, username, password, say)


async def _do_login(user_id: str, username: str, password: str, say) -> None:
    import asyncio
    from connect.client.auth.do_login import do_login
    from connect.client.auth.token_storage.set_user_data import set_user_data
    from connect.client import OpenJiuwenClient
    config = get_app_config()
    client = OpenJiuwenClient(base_url=config["backend_url"])
    result = await asyncio.get_event_loop().run_in_executor(None, lambda: do_login(client, username, password))
    ud = get_user_data(user_id)
    if result.get("error"):
        ud.pop("state", None)
        ud.pop("pending_username", None)
        await say(f"Login failed: {result['error']}")
        return
    set_user_data(user_id, result["token"], result["space_id"], result.get("refresh_token", ""))
    ud.pop("state", None)
    ud.pop("pending_username", None)
    await say(f"Logged in as `{username}`.")
