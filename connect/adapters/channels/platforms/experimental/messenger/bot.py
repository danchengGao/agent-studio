"""
Message router for the Messenger adapter.

Parses incoming message text, dispatches to the correct handler based on
per-user conversation state or the command keyword.
"""
from .handlers_registrator import route_message


async def handle_message(user_id: str, text: str, say) -> None:
    """Main entry point — called once per incoming Messenger text message.

    Args:
        user_id: Sender's Page-Scoped ID (PSID).
        text:    Stripped message body.
        say:     Async callable that sends a reply to user_id.
    """
    await route_message(user_id, text, say)
