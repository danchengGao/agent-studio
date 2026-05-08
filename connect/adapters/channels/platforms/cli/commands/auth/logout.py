"""Logout command."""
from openjiuwen.core.common.logging import logger
from connect.client.auth.token_storage import get_user_token, remove_user_token
from ...session import CLI_USER_ID


def cmd_logout() -> None:
    if not get_user_token(CLI_USER_ID):
        logger.info("ℹ️  Not logged in.")
        return
    remove_user_token(CLI_USER_ID)
    logger.info("✅ Logged out.")
