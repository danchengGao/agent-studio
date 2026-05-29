"""
Message router for the Google Assistant adapter.

Delegates to handlers_registrator.route_message — identical to WhatsApp/Teams.
"""
from .handlers_registrator import route_message


async def handle_message(session_id: str, text: str, say) -> None:
    """Main entry point — called once per fulfillment request.

    Args:
        session_id: Google Actions session ID, used as the persistent user key.
        text:       The user's raw speech/text from the Actions SDK request.
        say:        Async callable that accumulates reply text.
    """
    await route_message(session_id, text, say)
