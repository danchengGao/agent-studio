from connect.client.workflows import list_workflows
from ...client_session import get_backend_client


def handle_list(ack, respond, command):
    ack()
    user_id = command['user_id']
    client = get_backend_client(user_id, respond)
    if not client:
        return
    try:
        result = list_workflows(client)
        workflows = result.get('data', {}).get('workflow_list', [])
        total = result.get('data', {}).get('total', len(workflows))
        if not workflows:
            respond("ℹ️ No workflows found.")
            return
        lines = [f"✅ Found {total} workflow(s):\n"]
        for i, wf in enumerate(workflows[:10], 1):
            name = wf.get('name', 'Unnamed')
            wf_id = wf.get('workflow_id', 'N/A')
            desc = wf.get('desc', '')
            lines.append(f"{i}. *{name}*  |  ID: `{wf_id}`")
            if desc:
                lines.append(f"   _{desc[:80]}{'...' if len(desc) > 80 else ''}_")
        if total > 10:
            lines.append(f"_...and {total - 10} more_")
        lines.append("\n💡 Run a workflow: `/workflow_run <id>`")
        respond('\n'.join(lines))
    except Exception as e:
        respond(f"❌ Error: {e}")