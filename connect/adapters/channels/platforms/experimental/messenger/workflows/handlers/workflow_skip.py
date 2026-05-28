"""Handle the 'skip' command during workflow parameter collection."""
from ..._state_helpers import set_state
from ._execute_and_reply import execute_and_reply
from ....messenger.client_session import get_backend_client


async def handle(user_id: str, say, user_data: dict) -> None:
    wf = user_data.get('wf_pending')
    if wf is None:
        await say("No active workflow.")
        return
    idx: int = user_data.get('wf_param_index', 0)
    user_data['wf_param_index'] = idx + 1
    params = wf.get('input_params') or wf.get('params') or []
    if user_data['wf_param_index'] >= len(params):
        client, err = get_backend_client(user_id)
        set_state(user_data, 'idle')
        if err:
            await say(err)
            return
        collected = user_data.get('wf_params', {})
        await execute_and_reply(client, wf, collected, say)
        user_data.pop('wf_pending', None)
        user_data.pop('wf_params', None)
        user_data.pop('wf_param_index', None)
    else:
        next_param = params[user_data['wf_param_index']]
        await say(f"Skipped. Enter value for '{next_param.get('name', 'value')}':")
