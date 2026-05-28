from typing import Dict, Any


def search_agents(client, keyword: str) -> Dict[str, Any]:
    return client.post('/agents/search', data={
        'space_id': client.space_id,
        'search_term': keyword,
    })
