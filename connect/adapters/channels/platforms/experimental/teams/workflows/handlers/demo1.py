"""Demo 1 command handler."""
from openjiuwen.core.common.logging import logger


async def handle_demo1(user_id: str, say, user_data: dict) -> None:
    """Demo 1 - demo1"""
    message = "✅ Demo 1 Will be triggered here"
    logger.info(message)
    await say(message)
