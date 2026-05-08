"""Handle cancellation of a running workflow."""
from ..._state_helpers import set_state


async def handle(user_id: str, say, user_data: dict) -> None:
    set_state(user_data, 'idle')
    user_data.pop('wf_pending', None)
    user_data.pop('wf_params', None)
    user_data.pop('wf_param_index', None)
    await say("Workflow cancelled.")
