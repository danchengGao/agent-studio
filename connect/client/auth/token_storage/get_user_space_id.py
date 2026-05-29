from typing import Optional

from .load_user_tokens import load_user_tokens


def get_user_space_id(user_id) -> Optional[str]:
    """Get space_id for a specific user"""
    tokens = load_user_tokens()
    entry = tokens.get(str(user_id))
    if isinstance(entry, dict):
        return entry.get('space_id')
    return None
