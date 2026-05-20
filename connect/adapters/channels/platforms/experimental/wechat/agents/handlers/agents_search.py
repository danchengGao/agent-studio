from ....wechat.client_session import get_backend_client


async def handle(user_id: str, query: str, say, user_data: dict) -> None:
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    if not query:
        await say("Usage: agents search <query>")
        return
    try:
        agents = client.search_agents(query)
        if not agents:
            await say(f"No agents matching '{query}'.")
            return
        lines = [f"Agents matching '{query}':"]
        for ag in agents:
            name = ag.get('name', '?')
            desc = ag.get('description', '')
            lines.append(f"  {name}" + (f" - {desc}" if desc else ""))
        await say("\n".join(lines))
    except Exception as e:
        await say(f"Search failed: {e}")
