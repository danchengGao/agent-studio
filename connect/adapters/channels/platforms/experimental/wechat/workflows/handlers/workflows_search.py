from ....wechat.client_session import get_backend_client


async def handle(user_id: str, query: str, say, user_data: dict) -> None:
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    if not query:
        await say("Usage: workflows search <query>")
        return
    try:
        workflows = client.search_workflows(query)
        if not workflows:
            await say(f"No workflows matching '{query}'.")
            return
        lines = [f"Workflows matching '{query}':"]
        for wf in workflows:
            name = wf.get('name', '?')
            desc = wf.get('description', '')
            lines.append(f"  {name}" + (f" - {desc}" if desc else ""))
        await say("\n".join(lines))
    except Exception as e:
        await say(f"Search failed: {e}")
