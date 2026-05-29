from typing import Dict, Any


def get_spaces(client) -> Dict[str, Any]:
    return client.get('/spaces/')
