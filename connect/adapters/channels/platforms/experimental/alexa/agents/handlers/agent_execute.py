from ....alexa.client_session import get_backend_client


async def handle(user_id: str, name: str, say, user_data: dict) -> None:
    if not name:
        await say("Please say the agent name.")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        agents = client.list_agents()
        match = next((a for a in agents if a.get('name', '').lower() == name.lower()), None)
        if not match:
            await say(f"Agent {name} not found.")
            return
        result = client.run_agent(agent_id=match.get('id'))
        output = result.get('output') or result.get('reply') or str(result)
        await say(f"Agent result: {output}")
    except Exception as e:
        await say(f"Agent execution failed. {e}")
