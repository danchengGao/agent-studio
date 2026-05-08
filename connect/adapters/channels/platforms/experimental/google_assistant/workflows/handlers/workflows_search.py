from connect.client.workflows import search_workflows
from ...client_session import get_backend_client


async def handle_search(user_id, say, user_data, query=""):
    if not query:
        await say("Please say: workflows search followed by a keyword.")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    try:
        result = search_workflows(client, query)
        data = result.get("data", {})
        workflows = data.get("workflow_list", data.get("workflows", []))
        if not workflows:
            await say(f"No workflows found matching {query}.")
            return
        lines = [f"Found {len(workflows)} workflow matching {query}."]
        for i, wf in enumerate(workflows[:10], 1):
            lines.append(f"{i}. {wf.get('name', 'Unnamed')} with ID {wf.get('workflow_id', 'N/A')}")
        await say("\n".join(lines))
    except Exception as e:
        await say(f"Error: {e}")
