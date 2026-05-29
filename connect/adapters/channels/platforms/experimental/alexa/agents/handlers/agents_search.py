from ....alexa.client_session import get_backend_client


async def handle(user_id: str, query: str, say, user_data: dict) -> None:
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    if not query:
        await say("Please say a search term.")
        return
    try:
        agents = client.search_agents(query)
        if not agents:
            await say(f"No agents matching {query}.")
            return
        names = [a.get('name', 'unknown') for a in agents]
        await say(f"Found: {', '.join(names)}.")
    except Exception as e:
        await say(f"Search failed. {e}")
