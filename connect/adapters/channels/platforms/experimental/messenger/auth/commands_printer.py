"""Print auth-related commands for the Messenger bot."""

from openjiuwen.core.common.logging import logger


def print_auth_commands() -> None:
    logger.info("  Auth commands:")
    logger.info("    login           Log in to OpenJiuwen")
    logger.info("    logout          Log out")
    logger.info("    status          Show login status")
