from typing import Dict, Any


def list_agents(client, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    return client.post('/agents/list', data={
        'space_id': client.space_id,
        'page': page,
        'page_size': page_size,
    })
