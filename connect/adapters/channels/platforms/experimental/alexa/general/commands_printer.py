from openjiuwen.core.common.logging import logger


def print_general_commands() -> None:
    logger.info("  General commands (voice):")
    logger.info("    help            Hear available commands")
    logger.info("    start           Introduction")
    logger.info("    health          Backend health check")
