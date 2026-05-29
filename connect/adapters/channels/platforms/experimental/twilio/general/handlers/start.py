"""Welcome message."""
from .help import handle_help


async def handle_start(user_id: str, text: str, say) -> None:
    await say("Welcome to OpenJiuwen via SMS!")
    await handle_help(user_id, text, say)
