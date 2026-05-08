from connect.client.workflows.get_workflow import get_workflow
from connect.client.workflows import ParamCollectionSession
from ...client_session import get_backend_client
from ._execute_and_reply import _execute_and_say


async def handle_run(user_id, say, user_data, workflow_id=""):
    if not workflow_id:
        await say("Please say: workflow execute followed by the workflow ID.")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        result = get_workflow(client, workflow_id)
        wf_data = result.get("data", {}).get("workflow", {})
        params = wf_data.get("input_parameters", [])
    except Exception as e:
        await say(f"Could not fetch workflow info: {e}")
        return
    if not params:
        await _execute_and_say(say, client, workflow_id, {})
        return
    session = ParamCollectionSession(workflow_id, params)
    user_data["wf_exec_session"] = session
    user_data["state"] = "wf_collecting"
    wf_name = wf_data.get("name", workflow_id)
    await say(
        f"Workflow {wf_name} needs {session.total} parameter or parameters. "
        "I will ask for each one. Say skip to skip optional ones, or say workflow cancel to abort. "
        + session.format_prompt(1, session.total)
    )
