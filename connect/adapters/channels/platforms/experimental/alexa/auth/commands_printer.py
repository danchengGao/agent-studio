from openjiuwen.core.common.logging import logger


def print_auth_commands() -> None:
    logger.info("  Auth commands (voice):")
    logger.info("    login           Log in to OpenJiuwen")
    logger.info("    logout          Log out")
    logger.info("    status          Show login status")
