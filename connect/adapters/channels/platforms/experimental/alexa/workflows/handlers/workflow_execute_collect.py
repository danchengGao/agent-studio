from ..._state_helpers import set_state
from ._execute_and_reply import execute_and_reply
from ....alexa.client_session import get_backend_client


async def handle(user_id: str, text: str, say, user_data: dict) -> None:
    wf = user_data.get('wf_pending')
    collected: dict = user_data.get('wf_params', {})
    idx: int = user_data.get('wf_param_index', 0)
    if wf is None:
        set_state(user_data, 'idle')
        await say("No active workflow. Say workflows to start.")
        return
    params = wf.get('input_params') or wf.get('params') or []
    if idx < len(params):
        param = params[idx]
        param_name = param.get('name', f'param{idx}')
        collected[param_name] = text
        user_data['wf_params'] = collected
        user_data['wf_param_index'] = idx + 1
    next_idx = user_data['wf_param_index']
    if next_idx < len(params):
        next_param = params[next_idx]
        next_name = next_param.get('name', 'value')
        await say(f"Please say the value for {next_name}.")
        return
    client, err = get_backend_client(user_id)
    set_state(user_data, 'idle')
    if err:
        await say(err)
        return
    await execute_and_reply(client, wf, collected, say)
    user_data.pop('wf_pending', None)
    user_data.pop('wf_params', None)
    user_data.pop('wf_param_index', None)
