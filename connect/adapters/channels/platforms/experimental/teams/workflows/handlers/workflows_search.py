"""Search workflows command handler."""
from connect.client.workflows import search_workflows
from ...client_session import get_backend_client


async def handle_search(user_id: str, say, user_data: dict, query: str = '') -> None:
    if not query:
        await say("Usage: `workflows search <keyword>`")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        result = search_workflows(client, query)
        data = result.get('data', {})
        workflows = data.get('workflow_list', data.get('workflows', []))
        if not workflows:
            await say(f"ℹ️ No workflows found matching `{query}`.")
            return
        lines = [f"🔍 Found {len(workflows)} workflow(s) matching `{query}`:\n"]
        for i, wf in enumerate(workflows[:10], 1):
            name = wf.get('name', 'Unnamed')
            wf_id = wf.get('workflow_id', 'N/A')
            lines.append(f"{i}. **{name}**  |  ID: `{wf_id}`")
        await say('\n'.join(lines))
    except Exception as e:
        await say(f"❌ Error: {e}")
