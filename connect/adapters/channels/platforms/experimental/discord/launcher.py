"""
Discord bot launcher.

Uses the Discord Gateway (WebSocket) — no public URL needed.
Slash commands register automatically via tree.sync() on first connect.

Usage:
    python -m connect.adapters.channels.run discord <BOT_TOKEN> [BACKEND_URL] [ACCESS_TOKEN]

Arguments:
    BOT_TOKEN      (required) Bot token from Discord Developer Portal
                              discord.com/developers/applications → Bot → Token
    BACKEND_URL    (optional) OpenJiuwen backend URL
                              default: http://localhost:8000
                              env: BACKEND_URL
    ACCESS_TOKEN   (optional) Static backend token — all users share it,
                              per-user login is skipped
                              env: ACCESS_TOKEN

Discord setup checklist:
    1. Create application at discord.com/developers/applications
    2. Add a Bot and copy the Token
    3. Enable Message Content Intent (Bot → Privileged Gateway Intents)
    4. Invite bot with scopes: bot + applications.commands
       Bot permissions: Send Messages, Read Message History

Examples:
    python -m connect.adapters.channels.run discord TOKEN
    python -m connect.adapters.channels.run discord TOKEN http://my-server:8000
    python -m connect.adapters.channels.run discord TOKEN http://my-server:8000 eyJhbGci...

See platforms/experimental/discord/SETUP.md for the full setup guide.
"""
import os
import sys
from pathlib import Path

# Set token storage path BEFORE any token_storage_file import.
os.environ.setdefault('OJ_TOKEN_STORAGE', str(Path(__file__).parent / '.discord_bot_tokens.json'))

import discord

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .handlers_registrator import register_handlers
from .state import set_app_config


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
        logger.info((__doc__ or '').strip())
        return

    bot_token = sys.argv[1]
    backend_url = sys.argv[2] if len(sys.argv) > 2 else os.getenv("BACKEND_URL", "http://localhost:8000")
    access_token = sys.argv[3] if len(sys.argv) > 3 else os.getenv("ACCESS_TOKEN")

    # Test backend connectivity
    probe_client = OpenJiuwenClient(base_url=backend_url)
    if access_token:
        probe_client.set_token(access_token)
        logger.info("Using static authentication token")
    try:
        health = health_check(probe_client)
        logger.info("Connected to OpenJiuwen backend at %s", backend_url)
        logger.info("   Backend status: %s", health)
    except Exception as e:
        logger.warning("Could not connect to backend at %s: %s", backend_url, e)
        logger.info("   Bot will continue but API calls may fail.")

    set_app_config(
        backend_url=backend_url,
        enable_password_login=ENABLE_PASSWORD_LOGIN,
    )
    logger.info(
        "Login mode: %s (VITE_ENABLE_NEW_AUTH=%s)",
        'with password' if ENABLE_PASSWORD_LOGIN else 'without password',
        ENABLE_PASSWORD_LOGIN,
    )

    intents = discord.Intents.default()
    intents.message_content = True   # privileged — must be enabled in Developer Portal
    intents.dm_messages = True

    bot = discord.Client(intents=intents)
    bot.tree = discord.app_commands.CommandTree(bot)

    register_handlers(bot)

    logger.info("\n%s", "=" * 60)
    logger.info("OpenJiuwen Discord Bot is starting...")
    logger.info("   Slash commands will sync on first connect.")
    logger.info("%s", "=" * 60)
    logger.info("Press Ctrl+C to stop the bot")
    logger.info("%s\n", "=" * 60)

    bot.run(bot_token)
