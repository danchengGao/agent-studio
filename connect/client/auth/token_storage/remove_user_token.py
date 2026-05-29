from .load_user_tokens import load_user_tokens
from .save_user_tokens import save_user_tokens


def remove_user_token(user_id):
    """Remove token for a specific user"""
    tokens = load_user_tokens()
    if str(user_id) in tokens:
        del tokens[str(user_id)]
        save_user_tokens(tokens)
