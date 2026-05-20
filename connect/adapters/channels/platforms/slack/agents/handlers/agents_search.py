from connect.client.agents import search_agents
from ...client_session import get_backend_client


def handle_search(ack, respond, command):
    ack()
    user_id = command['user_id']
    keyword = (command.get('text') or '').strip()
    if not keyword:
        respond("❌ Usage: `/agents_search <keyword>`")
        return
    client = get_backend_client(user_id, respond)
    if not client:
        return
    try:
        result = search_agents(client, keyword)
        agents = result.get('data', {}).get('agent_items', [])
        if not agents:
            respond(f"ℹ️ No agents found matching `{keyword}`.")
            return
        lines = [f"🔍 Found {len(agents)} agent(s) matching `{keyword}`:\n"]
        for i, agent in enumerate(agents[:10], 1):
            icon = agent.get('icon', '🤖')
            name = agent.get('agent_name', 'Unnamed')
            agent_id = agent.get('agent_id', 'N/A')
            lines.append(f"{i}. {icon} *{name}*  |  ID: `{agent_id}`")
        respond('\n'.join(lines))
    except Exception as e:
        respond(f"❌ Error: {e}")
