"""
Main bot class for the Microsoft Teams adapter.

Extends ActivityHandler and routes incoming messages to the appropriate
command handlers based on message text and per-user conversation state.
"""
import re
from botbuilder.core import ActivityHandler, TurnContext, MessageFactory
from botbuilder.schema import ChannelAccount

from .state import get_user_data
from .handlers_registrator import route_message

# Regex to strip <at>BotName</at> mentions from Teams channel messages.
_MENTION_RE = re.compile(r'<at>[^<]*</at>', re.IGNORECASE)


class OJTeamsBot(ActivityHandler):
    """OpenJiuwen Teams bot — routes messages to client handlers."""

    async def on_message_activity(self, turn_context: TurnContext) -> None:
        # Strip HTML mention tags present in channel (non-DM) messages.
        raw = turn_context.activity.text or ''
        text = _MENTION_RE.sub('', raw).strip()
        if not text:
            return

        # Use the AAD object ID (stable across name changes) if present,
        # otherwise fall back to the Teams user ID.
        from_prop = turn_context.activity.from_property
        user_id: str = (
            getattr(from_prop, 'aad_object_id', None)
            or from_prop.id
        )

        user_data = get_user_data(user_id)

        # Convenience wrapper so handlers don't need to import botbuilder.
        async def say(msg: str) -> None:
            await turn_context.send_activity(MessageFactory.text(msg))

        await route_message(text, user_id, say, user_data)

    async def on_members_added_activity(
        self, members_added: list[ChannelAccount], turn_context: TurnContext
    ) -> None:
        """Greet new members when the bot is added to a conversation."""
        bot_id = turn_context.activity.recipient.id
        for member in members_added:
            if member.id != bot_id:
                await turn_context.send_activity(
                    MessageFactory.text(
                        "👋 Hello! I'm the **OpenJiuwen Bot**.\n\n"
                        "Type `login` to authenticate, then `help` to see all available commands."
                    )
                )
