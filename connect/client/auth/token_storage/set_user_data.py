from .load_user_tokens import load_user_tokens
from .save_user_tokens import save_user_tokens


def set_user_data(user_id, token: str, space_id: str, refresh_token: str = None):
    """Save token, space_id, and optional refresh_token for a specific user"""
    tokens = load_user_tokens()
    entry = {'token': token, 'space_id': space_id}
    if refresh_token:
        entry['refresh_token'] = refresh_token
    tokens[str(user_id)] = entry
    save_user_tokens(tokens)
