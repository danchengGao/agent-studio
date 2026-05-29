"""Collect workflow parameters one by one."""
import asyncio
from connect.client.workflows.execute_workflow import execute_workflow
from connect.client.workflows import parse_workflow_result
from connect.client import OpenJiuwenClient
from ...state import get_user_data


async def handle_workflow_collect(user_id: str, text: str, say) -> None:
    ud = get_user_data(user_id)
    session = ud.get("workflow_session")
    if not session:
        await say("No active workflow. Comment `/workflow run <id>`.")
        return
    if text == "SKIP":
        error, done = session.skip()
    else:
        error, done = session.submit(text)
    if error:
        await say(error)
        if not done:
            await say(session.prompt_next())
        return
    if not done:
        await say(session.prompt_next())
        return
    cfg = ud.pop("workflow_client_config", {})
    ud.pop("workflow_session", None)
    client = OpenJiuwenClient(base_url=cfg.get("backend_url", ""))
    client.set_token(cfg.get("token", ""))
    client.space_id = cfg.get("space_id", "")
    collected = session.get_collected()
    await say("Running workflow...")
    try:
        events = await asyncio.get_event_loop().run_in_executor(
            None, lambda: execute_workflow(client, session.workflow_id, collected)
        )
        outputs, error = parse_workflow_result(events)
    except Exception as exc:
        await say(f"Execution failed: {exc}")
        return
    await say(f"Error: {error}" if error else (str(outputs) if outputs else "Workflow completed."))
