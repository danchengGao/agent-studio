from connect.client.agents import list_agents
from ...client_session import get_backend_client


async def handle_list(user_id, say, user_data):
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        result = list_agents(client)
        data = result.get("data", {})
        agents = data.get("agent_items", [])
        total = data.get("pagination", {}).get("total", len(agents))
        if not agents:
            await say("No agents found.")
            return
        lines = [f"Found {total} agent or agents."]
        for i, a in enumerate(agents[:10], 1):
            lines.append(f"{i}. {a.get('agent_name', 'Unnamed')} with ID {a.get('agent_id', 'N/A')}")
        if total > 10:
            lines.append(f"And {total - 10} more.")
        lines.append("To chat, say: agent start followed by the ID.")
        await say("\n".join(lines))
    except Exception as e:
        await say(f"Error: {e}")
