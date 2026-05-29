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
        workflows = client.search_workflows(query)
        if not workflows:
            await say(f"No workflows matching {query}.")
            return
        names = [w.get('name', 'unknown') for w in workflows]
        await say(f"Found: {', '.join(names)}.")
    except Exception as e:
        await say(f"Search failed. {e}")
