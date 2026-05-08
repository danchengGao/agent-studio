from ....wechat.client_session import get_backend_client


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
        lines = ["Available workflows:"]
        for wf in workflows:
            name = wf.get('name', '?')
            desc = wf.get('description', '')
            lines.append(f"  {name}" + (f" - {desc}" if desc else ""))
        lines.append("")
        lines.append("Run: workflow run <name>")
        await say("\n".join(lines))
    except Exception as e:
        await say(f"Failed to list workflows: {e}")
