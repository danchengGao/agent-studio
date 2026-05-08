"""Registers all slash commands and the DM message router with the Discord bot."""
import discord
from openjiuwen.core.common.logging import logger

from .agents import handlers_registrator as agents_handlers_registrator
from .auth import handlers_registrator as auth_handlers_registrator
from .general import handlers_registrator as general_handlers_registrator
from .workflows import handlers_registrator as workflows_handlers_registrator
from .state import get_user_data
from .auth.handlers import on_login_username, on_login_password
from .workflows.handlers import on_collect_param
from .agents.handlers import on_agent_message


def register_handlers(bot: discord.Client) -> None:
    # Register all slash commands onto the command tree
    general_handlers_registrator.register_handlers(bot)
    auth_handlers_registrator.register_handlers(bot)
    workflows_handlers_registrator.register_handlers(bot)
    agents_handlers_registrator.register_handlers(bot)

    # DM message router — dispatches based on per-user state
    @bot.event
    async def on_message(message: discord.Message):
        # Ignore bot's own messages
        if message.author == bot.user:
            return
        # Only handle DMs
        if not isinstance(message.channel, discord.DMChannel):
            return

        user_id = str(message.author.id)
        text = (message.content or '').strip()
        if not text:
            return

        user_data = get_user_data(user_id)
        state = user_data.get('state', 'idle')

        say = message.channel.send  # async callable matching our handler signatures

        if state == 'login_username':
            await on_login_username(user_id, text, say)
        elif state == 'login_password':
            await on_login_password(user_id, text, say)
        elif state == 'wf_collecting':
            await on_collect_param(user_id, text, say, user_data)
        elif state == 'agent_chat':
            await on_agent_message(user_id, text, say, user_data)
        else:
            await message.channel.send(
                "ℹ️ Use slash commands to interact. Type `/help` for available commands."
            )

    @bot.event
    async def on_ready():
        await bot.tree.sync()
        logger.info(f"✅ Logged in as {bot.user} (ID: {bot.user.id})")
        logger.info("   Slash commands synced.")
