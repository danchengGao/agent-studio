from connect.client.workflows import list_workflows
from ...client_session import get_backend_client


async def handle_list(user_id, say, user_data):
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        result = list_workflows(client)
        workflows = result.get("data", {}).get("workflow_list", [])
        total = result.get("data", {}).get("total", len(workflows))
        if not workflows:
            await say("No workflows found.")
            return
        lines = [f"Found {total} workflow or workflows."]
        for i, wf in enumerate(workflows[:10], 1):
            lines.append(f"{i}. {wf.get('name', 'Unnamed')} with ID {wf.get('workflow_id', 'N/A')}")
        if total > 10:
            lines.append(f"And {total - 10} more.")
        lines.append("To run one, say: workflow execute followed by the ID.")
        await say("\n".join(lines))
    except Exception as e:
        await say(f"Error: {e}")
