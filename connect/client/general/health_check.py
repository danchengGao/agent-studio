from typing import Dict, Any


def health_check(client) -> Dict[str, Any]:
    url = f"{client.base_url}/api/health"
    response = client.session.get(url)
    response.raise_for_status()
    return response.json()
