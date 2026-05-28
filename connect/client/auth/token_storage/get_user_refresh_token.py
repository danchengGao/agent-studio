from typing import Optional

from .load_user_tokens import load_user_tokens


def get_user_refresh_token(user_id) -> Optional[str]:
    """Get refresh token for a specific user"""
    tokens = load_user_tokens()
    entry = tokens.get(str(user_id))
    if isinstance(entry, dict):
        return entry.get('refresh_token')
    return None
