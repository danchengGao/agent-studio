"""List available workflows."""
import asyncio
from connect.client.workflows import list_workflows
from ...client_session import get_backend_client


async def handle_workflows_list(user_id: str, text: str, say) -> None:
    client, err = await get_backend_client(user_id, say)
    if err:
        return
    try:
        result = await asyncio.get_event_loop().run_in_executor(None, lambda: list_workflows(client))
    except Exception as exc:
        await say(f"Failed to list workflows: {exc}")
        return
    wfs = result if isinstance(result, list) else result.get("data", [])
    if not wfs:
        await say("No workflows found in your space.")
        return
    lines = ["**Workflows:**"]
    for wf in wfs[:10]:
        lines.append(f"- **{wf.get('name', '?')}** — `{wf.get('id', '?')} `")
    await say("\n".join(lines))
