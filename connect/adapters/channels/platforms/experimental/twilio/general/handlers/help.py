"""Show help text."""
from ...commands_printer import COMMANDS


async def handle_help(user_id: str, text: str, say) -> None:
    await say(COMMANDS.strip())
