"""
Pure login business logic — no platform dependencies.
Returns a dict with token, space_id, refresh_token on success.
Raises an exception with a user-friendly message on failure.
"""
from typing import Dict, Any, Optional

from openjiuwen.core.common.logging import logger
from .login import login
from .get_spaces import get_spaces


def do_login(client, username: str, password: str) -> Dict[str, Any]:
    """
    Authenticate against the backend and fetch the user's space.

    Returns:
        {'token': str, 'space_id': str | None, 'refresh_token': str | None}

    Raises:
        Exception: with a human-readable message on any failure.
    """
    result = login(client, username, password)

    # No-password login returns OAuth2 format: { "access_token": "..." } (top-level)
    # Password login returns ResponseModel:    { "data": { "access_token": "..." } }
    token: Optional[str] = (
        result.get('access_token') or
        result.get('data', {}).get('access_token') or
        result.get('data', {}).get('token')
    )
    refresh: Optional[str] = (
        result.get('refresh_token') or
        result.get('data', {}).get('refresh_token')
    )

    if not token:
        raise Exception('No token received from server')

    client.set_token(token)

    space_id: Optional[str] = None
    try:
        spaces_result = get_spaces(client)
        space_list = spaces_result.get('data', {}).get('space_list', [])
        if space_list:
            space_id = space_list[0].get('space_id')
            client.set_space_id(space_id)
    except Exception as exc:
        logger.warning("Failed to fetch space after login: %s", exc)

    return {'token': token, 'space_id': space_id, 'refresh_token': refresh}
