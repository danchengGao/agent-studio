import json
from openjiuwen.core.common.logging import logger

from .token_storage_file import TOKEN_STORAGE_FILE


def load_user_tokens() -> dict:
    """Load user tokens from file"""
    logger.info('[STORAGE] loading tokens from %s (exists=%s)', TOKEN_STORAGE_FILE, TOKEN_STORAGE_FILE.exists())
    if TOKEN_STORAGE_FILE.exists():
        try:
            with open(TOKEN_STORAGE_FILE, 'r') as f:
                data = json.load(f)
            logger.info('[STORAGE] loaded %d user entries from %s', len(data), TOKEN_STORAGE_FILE)
            return data
        except Exception as e:
            logger.warning('[STORAGE] could not load tokens from %s: %s', TOKEN_STORAGE_FILE, e)
            return {}
    logger.warning('[STORAGE] token file does not exist: %s', TOKEN_STORAGE_FILE)
    return {}
