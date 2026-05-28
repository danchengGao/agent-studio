"""List available agents."""
import asyncio
from connect.client.agents import list_agents
from ...client_session import get_backend_client


async def handle_agents_list(user_id: str, text: str, say) -> None:
    client, err = await get_backend_client(user_id, say)
    if err:
        return
    try:
        result = await asyncio.get_event_loop().run_in_executor(None, lambda: list_agents(client))
    except Exception as exc:
        await say(f"Failed to list agents: {exc}")
        return
    agents = result if isinstance(result, list) else result.get("data", [])
    if not agents:
        await say("No agents found in your space.")
        return
    lines = ["Agents:"]
    for a in agents[:10]:
        lines.append(f"  {a.get('name', '?')} — ID: {a.get('id', '?')} ")
    await say("\n".join(lines))
