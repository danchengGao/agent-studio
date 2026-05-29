"""Handle the 'cancel' command — abort any active flow."""
from ..._state_helpers import set_state


async def handle(user_id: str, say, user_data: dict) -> None:
    state = user_data.get('state', 'idle')
    if state == 'idle':
        await say("Nothing to cancel.")
        return
    set_state(user_data, 'idle')
    user_data.pop('login_username', None)
    user_data.pop('wf_pending', None)
    user_data.pop('wf_params', None)
    await say("Cancelled.")
