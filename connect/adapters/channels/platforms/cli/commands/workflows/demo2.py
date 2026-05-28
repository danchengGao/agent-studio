"""Demo 2 command."""
from openjiuwen.core.common.logging import logger


def cmd_demo2(backend_url: str) -> None:
    message = "🚀 Demo 2 Will be triggered here"
    logger.info(message)
