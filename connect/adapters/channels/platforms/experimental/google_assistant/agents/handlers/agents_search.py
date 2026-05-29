from connect.client.agents import search_agents
from ...client_session import get_backend_client


async def handle_search(user_id, say, user_data, query=""):
    if not query:
        await say("Please say: agents search followed by a keyword.")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        result = search_agents(client, query)
        agents = result.get("data", {}).get("agent_items", [])
        if not agents:
            await say(f"No agents found matching {query}.")
            return
        lines = [f"Found {len(agents)} agent matching {query}."]
        for i, a in enumerate(agents[:10], 1):
            lines.append(f"{i}. {a.get('agent_name', 'Unnamed')} with ID {a.get('agent_id', 'N/A')}")
        await say("\n".join(lines))
    except Exception as e:
        await say(f"Error: {e}")
