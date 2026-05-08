"""Run workflow command handler — starts execution or collects params interactively."""
from connect.client.workflows.get_workflow import get_workflow
from connect.client.workflows import ParamCollectionSession
from ...client_session import get_backend_client
from ._execute_and_reply import _execute_and_say


async def handle_run(user_id: str, say, user_data: dict, workflow_id: str = '') -> None:
    if not workflow_id:
        await say("Usage: *workflow run <workflow-id>*")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        result = get_workflow(client, workflow_id)
        wf_data = result.get('data', {}).get('workflow', {})
        params = wf_data.get('input_parameters', [])
    except Exception as e:
        await say(f"❌ Could not fetch workflow info: {e}")
        return

    if not params:
        await _execute_and_say(say, client, workflow_id, {})
        return

    session = ParamCollectionSession(workflow_id, params)
    user_data['wf_exec_session'] = session
    user_data['state'] = 'wf_collecting'

    wf_name = wf_data.get('name', workflow_id)
    prompt = (
        f"⚙️ *{wf_name}* needs {session.total} parameter(s).\n"
        "Reply with each value when prompted. "
        "Send *skip* to skip optional params or *workflow cancel* to abort.\n\n"
        + session.format_prompt(1, session.total)
    )
    await say(prompt)
