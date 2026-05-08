from connect.client.workflows import search_workflows
from ...client_session import get_backend_client


def handle_search(ack, respond, command):
    ack()
    user_id = command['user_id']
    keyword = (command.get('text') or '').strip()
    if not keyword:
        respond("❌ Usage: `/workflows_search <keyword>`")
        return
    client = get_backend_client(user_id, respond)
    if not client:
        return
    try:
        result = search_workflows(client, keyword)
        data = result.get('data', {})
        workflows = data.get('workflow_list', data.get('workflows', []))
        if not workflows:
            respond(f"ℹ️ No workflows found matching `{keyword}`.")
            return
        lines = [f"🔍 Found {len(workflows)} workflow(s) matching `{keyword}`:\n"]
        for i, wf in enumerate(workflows[:10], 1):
            name = wf.get('name', 'Unnamed')
            wf_id = wf.get('workflow_id', 'N/A')
            lines.append(f"{i}. *{name}*  |  ID: `{wf_id}`")
        respond('\n'.join(lines))
    except Exception as e:
        respond(f"❌ Error: {e}")