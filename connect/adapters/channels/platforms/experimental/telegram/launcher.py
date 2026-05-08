"""
Telegram bot launcher.

Uses the Telegram Bot API in long-polling mode — no public URL needed.

Usage:
    python -m connect.adapters.channels.run telegram <BOT_TOKEN> [BACKEND_URL] [ACCESS_TOKEN]

Arguments:
    BOT_TOKEN      (required) Telegram bot token from @BotFather
    BACKEND_URL    (optional) OpenJiuwen backend URL
                              default: http://localhost:8000
                              env: BACKEND_URL
    ACCESS_TOKEN   (optional) Static backend token — all users share it,
                              per-user login is skipped
                              env: ACCESS_TOKEN

Login mode is controlled by VITE_ENABLE_NEW_AUTH in the project .env:
    True  → users log in with username + password
    False → users log in without password

Examples:
    python -m connect.adapters.channels.run telegram 123456:ABCDEF
    python -m connect.adapters.channels.run telegram 123456:ABCDEF http://my-server:8000
    python -m connect.adapters.channels.run telegram 123456:ABCDEF http://my-server:8000 eyJhbGci...

See platforms/experimental/telegram/SETUP.md for the full setup guide.
"""
import os
import sys
from pathlib import Path

from openjiuwen.core.common.logging import logger

os.environ.setdefault('OJ_TOKEN_STORAGE', str(Path(__file__).parent / '.telegram_bot_tokens.json'))

from telegram.ext import ApplicationBuilder

from connect.client.general.health_check import health_check
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from .commands_printer import print_bot_commands
from .handlers_registrator import register_handlers


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
        logger.info((__doc__ or '').strip())
        return

    bot_token = sys.argv[1]
    backend_url = sys.argv[2] if len(sys.argv) > 2 else os.getenv("BACKEND_URL", "http://localhost:8000")
    access_token = sys.argv[3] if len(sys.argv) > 3 else os.getenv("ACCESS_TOKEN")

    # Initialise backend client
    backend_client = OpenJiuwenClient(base_url=backend_url)
    if access_token:
        backend_client.set_token(access_token)
        logger.info("✅ Using authentication token")

    # Test backend connectivity
    try:
        health = health_check(backend_client)
        logger.info(f"✅ Connected to OpenJiuwen backend at {backend_url}")
        logger.info(f"   Backend status: {health}")
    except Exception as e:
        logger.info(f"⚠️  Warning: Could not connect to backend at {backend_url}")
        logger.info(f"   Error: {e}")
        logger.info("   Bot will continue but API calls may fail.")

    # Build Telegram application
    app = ApplicationBuilder().token(bot_token).build()
    app.bot_data['backend_client'] = backend_client
    app.bot_data['enable_password_login'] = ENABLE_PASSWORD_LOGIN

    def create_client():
        return OpenJiuwenClient(base_url=backend_url)
    app.bot_data['create_user_client'] = create_client

    logger.info(
        f"🔐 Login mode: {'with password' if ENABLE_PASSWORD_LOGIN else 'without password'} "
        f"(VITE_ENABLE_NEW_AUTH={ENABLE_PASSWORD_LOGIN})"
    )

    register_handlers(app)

    logger.info("\n" + "=" * 60)
    logger.info("🤖 OpenJiuwen Telegram Bot is running!")
    logger.info("=" * 60)
    print_bot_commands()
    logger.info("=" * 60)
    logger.info("⏹️  Press Ctrl+C to stop the bot")
    logger.info("=" * 60 + "\n")

    app.run_polling()
