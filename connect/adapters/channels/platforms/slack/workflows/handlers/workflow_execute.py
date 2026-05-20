from connect.client.workflows.get_workflow import get_workflow
from connect.client.workflows import ParamCollectionSession
from ._execute_and_reply import _execute_and_reply
from ...client_session import get_backend_client
from ...state import get_user_data


def handle_run(ack, respond, command):
    ack()
    user_id = command['user_id']
    workflow_id = (command.get('text') or '').strip()
    if not workflow_id:
        respond("❌ Usage: `/workflow_run <workflow_id>`")
        return
    client = get_backend_client(user_id, respond)
    if not client:
        return
    try:
        result = get_workflow(client, workflow_id)
        wf_data = result.get('data', {}).get('workflow', {})
        params = wf_data.get('input_parameters', [])
    except Exception as e:
        respond(f"❌ Could not fetch workflow info: {e}")
        return

    if not params:
        _execute_and_reply(client, workflow_id, {}, respond)
        return

    session = ParamCollectionSession(workflow_id, params)
    user_data = get_user_data(user_id)
    user_data['wf_exec_session'] = session
    user_data['state'] = 'wf_collecting'

    wf_name = wf_data.get('name', workflow_id)
    respond(
        f"⚙️ *{wf_name}* needs {session.total} parameter(s).\n"
        f"Reply here with each value. Type `/workflow_cancel` to abort.\n\n"
        + session.format_prompt(1, session.total)
    )