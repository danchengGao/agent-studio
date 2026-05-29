"""Demo 2 command handler."""
from openjiuwen.core.common.logging import logger


async def handle_demo2(user_id: str, say, user_data: dict) -> None:
    """Demo 2 - demo2"""
    message = "🚀 Demo 2 Will be triggered here"
    logger.info(message)
    await say(message)
