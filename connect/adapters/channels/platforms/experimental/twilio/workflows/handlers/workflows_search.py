"""Search workflows by keyword."""
import asyncio
from connect.client.workflows import search_workflows
from ...client_session import get_backend_client


async def handle_workflows_search(user_id: str, query: str, say) -> None:
    if not query:
        await say("Usage: workflows search <keyword>")
        return
    client, err = await get_backend_client(user_id, say)
    if err:
        return
    try:
        result = await asyncio.get_event_loop().run_in_executor(None, lambda: search_workflows(client, query))
    except Exception as exc:
        await say(f"Search failed: {exc}")
        return
    wfs = result if isinstance(result, list) else result.get("data", [])
    if not wfs:
        await say(f"No workflows found matching: {query}")
        return
    lines = [f"Workflows matching '{query}':"]
    for wf in wfs[:10]:
        lines.append(f"  {wf.get('name', '?')} — ID: {wf.get('id', '?')} ")
    await say("\n".join(lines))
