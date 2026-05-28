from typing import Dict, Any


def search_workflows(client, keyword: str) -> Dict[str, Any]:
    return client.post('/workflows/search', data={
        'space_id': client.space_id,
        'search_term': keyword,
    })
