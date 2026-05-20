"""
Slack-specific auth helper.

Unlike the Telegram @require_login decorator, Slack Bolt uses dependency
injection by parameter name, which makes decorators fragile. Instead this
module exposes get_backend_client() — a plain function that each handler
calls at the top to obtain an authenticated OpenJiuwenClient or bail early.
"""
from typing import Callable, Optional

from openjiuwen.core.common.logging import logger

from connect.client import OpenJiuwenClient
from connect.client.auth.token_storage import (
    get_user_token,
    get_user_space_id,
    get_user_refresh_token,
    remove_user_token,
)
from connect.client.auth.token_manager import verify_and_refresh
from .state import get_user_data, get_app_config


def get_backend_client(user_id: str, respond: Callable) -> Optional[OpenJiuwenClient]:
    """Return an authenticated OpenJiuwenClient, or None if auth fails.

    Calls `respond` with an error message and returns None when:
    - the user is not logged in
    - the token is expired and refresh fails
    """
    token = get_user_token(user_id)
    logger.info('[AUTH] user=%s token_present=%s token_prefix=%s', user_id, bool(token), (token[:12] + '...')
    if token else None)
    if not token:
        logger.warning('[AUTH] user=%s — no token in storage, prompting login', user_id)
        respond("❌ Not logged in. Use `/login` to authenticate.")
        return None

    backend_url = get_app_config().get('backend_url', 'http://localhost:8000')
    logger.info('[AUTH] user=%s backend_url=%s', user_id, backend_url)
    user_data = get_user_data(user_id)

    client: Optional[OpenJiuwenClient] = user_data.get('backend_client')
    if client is None:
        logger.info('[AUTH] user=%s — creating new OpenJiuwenClient', user_id)
        client = OpenJiuwenClient(base_url=backend_url)
        user_data['backend_client'] = client
    else:
        logger.info('[AUTH] user=%s — reusing cached OpenJiuwenClient', user_id)

    client.set_token(token)
    client.set_space_id(get_user_space_id(user_id))

    refresh_token = get_user_refresh_token(user_id)
    logger.info('[AUTH] user=%s refresh_token_present=%s', user_id, bool(refresh_token))

    ok, new_token = verify_and_refresh(client, user_id, refresh_token)
    logger.info('[AUTH] user=%s verify_and_refresh ok=%s new_token_issued=%s', user_id, ok, bool(new_token))
    if not ok:
        logger.error('[AUTH] user=%s — verify_and_refresh returned False → showing "Session expired"', user_id)
        respond("❌ Session expired. Use `/login` to authenticate again.")
        remove_user_token(user_id)
        return None

    return client
