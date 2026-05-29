"""
Message router for the Email adapter.

Parses the command extracted from the email body and dispatches to the
correct handler based on per-user conversation state or the command keyword.
"""
from .handlers_registrator import route_message


async def handle_message(user_id: str, text: str, say) -> None:
    """Main entry point — called once per inbound email command.

    Args:
        user_id: Sender's email address (lowercase), used as the persistent user key.
        text:    The command line extracted from the email body.
        say:     Async callable that sends a reply to user_id.
    """
    await route_message(user_id, text, say)
