from ....alexa.client_session import get_backend_client


async def handle(user_id: str, say, user_data: dict) -> None:
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        agents = client.list_agents()
        if not agents:
            await say("No agents found.")
            return
        names = [a.get('name', 'unknown') for a in agents]
        await say(f"Available agents: {', '.join(names)}. Say agent run followed by a name to start.")
    except Exception as e:
        await say(f"Failed to list agents. {e}")
