"""
Message router for the Alexa adapter.

Parses incoming command text, dispatches to the correct handler based on
per-user conversation state or the command keyword.
"""
from .handlers_registrator import route_message


async def handle_message(user_id: str, text: str, say) -> None:
    """Main entry point — called once per incoming Alexa intent.

    Args:
        user_id: Alexa user ID (persistent across sessions).
        text:    Stripped spoken command.
        say:     Async callable that collects the reply text.
    """
    await route_message(user_id, text, say)
