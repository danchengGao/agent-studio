from ....alexa.client_session import get_backend_client


async def handle(user_id: str, say, user_data: dict) -> None:
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        workflows = client.list_workflows()
        if not workflows:
            await say("No workflows found.")
            return
        names = [w.get('name', 'unknown') for w in workflows]
        names_spoken = ', '.join(names)
        await say(f"Available workflows: {names_spoken}. Say workflow run followed by a name to run one.")
    except Exception as e:
        await say(f"Failed to list workflows. {e}")
