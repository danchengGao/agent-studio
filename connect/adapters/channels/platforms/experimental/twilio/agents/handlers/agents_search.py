"""Search agents by keyword."""
import asyncio
from connect.client.agents import search_agents
from ...client_session import get_backend_client


async def handle_agents_search(user_id: str, query: str, say) -> None:
    if not query:
        await say("Usage: agents search <keyword>")
        return
    client, err = await get_backend_client(user_id, say)
    if err:
        return
    try:
        result = await asyncio.get_event_loop().run_in_executor(None, lambda: search_agents(client, query))
    except Exception as exc:
        await say(f"Search failed: {exc}")
        return
    agents = result if isinstance(result, list) else result.get("data", [])
    if not agents:
        await say(f"No agents found matching: {query}")
        return
    lines = [f"Agents matching '{query}':"]
    for a in agents[:10]:
        lines.append(f"  {a.get('name', '?')} — ID: {a.get('id', '?')} ")
    await say("\n".join(lines))
