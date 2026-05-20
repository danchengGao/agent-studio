from connect.client.agents import list_agents
from ...client_session import get_backend_client


def handle_list(ack, respond, command):
    ack()
    user_id = command['user_id']
    client = get_backend_client(user_id, respond)
    if not client:
        return
    try:
        result = list_agents(client)
        data = result.get('data', {})
        agents = data.get('agent_items', [])
        total = data.get('pagination', {}).get('total', len(agents))
        if not agents:
            respond("ℹ️ No agents found.")
            return
        lines = [f"✅ Found {total} agent(s):\n"]
        for i, agent in enumerate(agents[:10], 1):
            icon = agent.get('icon', '🤖')
            name = agent.get('agent_name', 'Unnamed')
            agent_id = agent.get('agent_id', 'N/A')
            desc = agent.get('description', '')
            lines.append(f"{i}. {icon} *{name}*  |  ID: `{agent_id}`")
            if desc:
                lines.append(f"   _{desc[:60]}{'...' if len(desc) > 60 else ''}_")
        if total > 10:
            lines.append(f"_...and {total - 10} more_")
        lines.append("\n💡 Chat: `/agent_chat <id>`  or  Single run: `/agent_run <id> <message>`")
        respond('\n'.join(lines))
    except Exception as e:
        respond(f"❌ Error: {e}")
