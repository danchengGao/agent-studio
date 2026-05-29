"""Demo 1 command."""
from openjiuwen.core.common.logging import logger


def cmd_demo1(backend_url: str) -> None:
    message = "✅ Demo 1 Will be triggered here"
    logger.info(message)
