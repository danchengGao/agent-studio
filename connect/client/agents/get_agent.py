from typing import Dict, Any


def get_agent(client, agent_id: str) -> Dict[str, Any]:
    return client.get(f'/agents/{agent_id}', params={'space_id': client.space_id or ''})
