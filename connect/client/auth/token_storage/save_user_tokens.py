import json

from openjiuwen.core.common.logging import logger

from .token_storage_file import TOKEN_STORAGE_FILE


def save_user_tokens(tokens: dict):
    """Save user tokens to file, creating parent directories if needed."""
    try:
        TOKEN_STORAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_STORAGE_FILE, 'w') as f:
            json.dump(tokens, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving tokens: {e}")
