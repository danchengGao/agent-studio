from typing import Dict, Any


def login(client, username: str, password: str = '') -> Dict[str, Any]:
    url = client.get_url('/auth/login')
    response = client.session.post(url, data={
        'username': username,
        'password': password,
        'grant_type': 'password',
    }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    response.raise_for_status()
    return response.json()
