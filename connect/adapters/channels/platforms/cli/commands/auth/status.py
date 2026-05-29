"""Status command."""
from openjiuwen.core.common.logging import logger
from connect.client.auth.token_storage import get_user_token, remove_user_token
from connect.client.auth.verify_token import verify_token as api_verify_token
from connect.client import OpenJiuwenClient

from ...session import CLI_USER_ID


def cmd_status(backend_url: str) -> None:
    token = get_user_token(CLI_USER_ID)
    if not token:
        logger.error("❌ Not logged in.")
        return
    client = OpenJiuwenClient(base_url=backend_url)
    client.set_token(token)
    try:
        api_verify_token(client)
        logger.info(f"✅ Logged in as OS user '{CLI_USER_ID}' — token is valid.")
    except Exception:
        logger.error("❌ Token expired. Run 'login' again.")
        remove_user_token(CLI_USER_ID)
