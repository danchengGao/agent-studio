from ....alexa.client_session import get_backend_client
from ..._state_helpers import set_state


async def handle(user_id: str, name: str, say, user_data: dict) -> None:
    if not name:
        await say("Please say the workflow name.")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        workflows = client.list_workflows()
        match = next((w for w in workflows if w.get('name', '').lower() == name.lower()), None)
        if not match:
            await say(f"Workflow {name} not found. Say workflows to hear available workflows.")
            return
        params = match.get('input_params') or match.get('params') or []
        if not params:
            from ._execute_and_reply import execute_and_reply
            await execute_and_reply(client, match, {}, say)
            return
        user_data['wf_pending'] = match
        user_data['wf_params'] = {}
        user_data['wf_param_index'] = 0
        set_state(user_data, 'wf_collecting')
        first_param = params[0]
        param_name = first_param.get('name', 'value')
        await say(f"Starting workflow {name}. Please say the value for {param_name}.")
    except Exception as e:
        await say(f"Failed to start workflow. {e}")
