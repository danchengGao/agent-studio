"""
Discord-specific auth helper.

Discord handlers are async and use interaction.followup.send() to reply,
so the respond-callback pattern used by Slack doesn't translate cleanly.
Instead this module returns a (client, error_message) tuple — the async
handler awaits the error send itself if needed.
"""
from typing import Optional, Tuple

from connect.client import OpenJiuwenClient
from connect.client.auth.token_storage import (
    get_user_token,
    get_user_space_id,
    get_user_refresh_token,
    remove_user_token,
)
from connect.client.auth.token_manager import verify_and_refresh
from .state import get_user_data, get_app_config


def get_backend_client(user_id: str) -> Tuple[Optional[OpenJiuwenClient], Optional[str]]:
    """Return (client, None) on success or (None, error_message) on failure.

    The caller is responsible for awaiting the error reply:
        client, err = get_backend_client(user_id)
        if err:
            await interaction.followup.send(err)
            return
    """
    token = get_user_token(user_id)
    if not token:
        return None, "❌ Not logged in. Use `/login` to authenticate."

    backend_url = get_app_config().get('backend_url', 'http://localhost:8000')
    user_data = get_user_data(user_id)

    client: Optional[OpenJiuwenClient] = user_data.get('backend_client')
    if client is None:
        client = OpenJiuwenClient(base_url=backend_url)
        user_data['backend_client'] = client

    client.set_token(token)
    client.set_space_id(get_user_space_id(user_id))

    ok, _ = verify_and_refresh(client, user_id, get_user_refresh_token(user_id))
    if not ok:
        remove_user_token(user_id)
        return None, "❌ Session expired. Use `/login` to authenticate again."

    return client, None
