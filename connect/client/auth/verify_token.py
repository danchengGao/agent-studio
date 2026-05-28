from typing import Dict, Any


def verify_token(client) -> Dict[str, Any]:
    return client.get('/auth/verify_access_token')
