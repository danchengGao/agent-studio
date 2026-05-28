"""Start executing a workflow, collect params if needed."""
import asyncio
from connect.client.workflows.get_workflow import get_workflow
from connect.client.workflows.execute_workflow import execute_workflow
from connect.client.workflows import parse_workflow_result
from connect.client.workflows import ParamCollectionSession
from ...client_session import get_backend_client
from ...state import get_user_data


async def handle_workflow_execute(user_id: str, workflow_id: str, say) -> None:
    if not workflow_id:
        await say("Usage: `/workflow run <workflow_id>`")
        return
    client, err = await get_backend_client(user_id, say)
    if err:
        return
    try:
        wf = await asyncio.get_event_loop().run_in_executor(None, lambda: get_workflow(client, workflow_id))
    except Exception as exc:
        await say(f"Could not fetch workflow: {exc}")
        return
    params = wf.get("input_parameters") or wf.get("inputParameters") or []
    if not params:
        await say("Running workflow...")
        try:
            events = await asyncio.get_event_loop().run_in_executor(
                None, lambda: execute_workflow(client, workflow_id, {})
            )
            outputs, error = parse_workflow_result(events)
        except Exception as exc:
            await say(f"Execution failed: {exc}")
            return
        await say(f"Error: {error}" if error else (str(outputs) if outputs else "Workflow completed."))
        return
    session = ParamCollectionSession(workflow_id, params)
    ud = get_user_data(user_id)
    ud["workflow_session"] = session
    ud["workflow_client_config"] = {
        "backend_url": client.base_url,
        "token": client.token,
        "space_id": client.space_id,
    }
    await say(session.prompt_next())
