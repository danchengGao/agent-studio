"""Search agents command handler."""
from connect.client.agents import search_agents
from ...client_session import get_backend_client


async def handle_search(user_id: str, say, user_data: dict, query: str = "") -> None:
    if not query:
        await say("Usage: agents search <keyword>")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        result = search_agents(client, query)
        agents = result.get("data", {}).get("agent_items", [])
        if not agents:
            await say(f"No agents found matching: {query}")
            return
        lines = [f"Found {len(agents)} agent(s) matching '{query}':\n"]
        for i, agent in enumerate(agents[:10], 1):
            name = agent.get("agent_name", "Unnamed")
            agent_id = agent.get("agent_id", "N/A")
            lines.append(f"{i}. {name}  |  ID: {agent_id}")
        await say("\n".join(lines))
    except Exception as e:
        await say(f"Error: {e}")
