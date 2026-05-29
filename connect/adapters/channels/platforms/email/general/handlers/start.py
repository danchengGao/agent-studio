"""Start/welcome command handler."""
from .help import handle_help


async def handle_start(user_id: str, say, user_data: dict) -> None:
    await say(
        "Welcome to OpenJiuwen!\n\n"
        "Send commands by emailing this address with the command on the first line.\n\n"
        "Type: help  — to see all available commands.\n"
        "Type: login  — to get started."
    )
