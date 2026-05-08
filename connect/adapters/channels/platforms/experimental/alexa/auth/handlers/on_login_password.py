from ..._state_helpers import set_state
from ._do_login import do_login


async def handle(user_id: str, text: str, say, user_data: dict) -> None:
    username = user_data.pop('login_username', '')
    set_state(user_data, 'idle')
    await do_login(user_id, username, text, say, user_data)
