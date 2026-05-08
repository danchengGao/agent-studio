"""List workflows command handler."""
from connect.client.workflows import list_workflows
from ...client_session import get_backend_client


async def handle_list(user_id: str, say, user_data: dict) -> None:
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        result = list_workflows(client)
        workflows = result.get('data', {}).get('workflow_list', [])
        total = result.get('data', {}).get('total', len(workflows))
        if not workflows:
            await say("ℹ️ No workflows found.")
            return
        lines = [f"✅ Found {total} workflow(s):\n"]
        for i, wf in enumerate(workflows[:10], 1):
            name = wf.get('name', 'Unnamed')
            wf_id = wf.get('workflow_id', 'N/A')
            desc = wf.get('desc', '')
            lines.append(f"{i}. **{name}**  |  ID: `{wf_id}`")
            if desc:
                lines.append(f"   *{desc[:80]}{'...' if len(desc) > 80 else ''}*")
        if total > 10:
            lines.append(f"*...and {total - 10} more*")
        lines.append("\n💡 Run a workflow: `workflow run <id>`")
        await say('\n'.join(lines))
    except Exception as e:
        await say(f"❌ Error: {e}")
