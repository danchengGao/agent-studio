"""Handle the 'agents' command — list available agents."""
from ....messenger.client_session import get_backend_client


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
        lines = ["Available agents:"]
        for ag in agents:
            name = ag.get('name', '?')
            desc = ag.get('description', '')
            lines.append(f"  {name}" + (f" — {desc}" if desc else ""))
        lines.append("")
        lines.append("Start: agent run <name>")
        await say("\n".join(lines))
    except Exception as e:
        await say(f"Failed to list agents: {e}")
