"""Handle the 'logout' command."""
from connect.client.auth.token_storage import remove_user_token
from ..._state_helpers import set_state


async def handle(user_id: str, say, user_data: dict) -> None:
    remove_user_token(user_id)
    user_data.pop('backend_client', None)
    set_state(user_data, 'idle')
    await say("Logged out successfully.")
