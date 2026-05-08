from typing import Dict, Any


def refresh_token(client, token: str) -> Dict[str, Any]:
    return client.post('/auth/refresh', data={'refreshToken': token})
