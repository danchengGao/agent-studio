"""
Slack bot launcher.

Uses Socket Mode — no public URL needed. Requires two tokens.

Usage:
    python -m connect.adapters.channels.run slack <BOT_TOKEN> <APP_TOKEN> [BACKEND_URL] [ACCESS_TOKEN]

Arguments:
    BOT_TOKEN      (required) xoxb-... Bot User OAuth Token
                              Slack App → OAuth & Permissions
    APP_TOKEN      (required) xapp-... App-Level Token (connections:write scope)
                              Slack App → App-Level Tokens
    BACKEND_URL    (optional) OpenJiuwen backend URL
                              default: http://localhost:8000
                              env: BACKEND_URL
    ACCESS_TOKEN   (optional) Static backend token — all users share it,
                              per-user login is skipped
                              env: ACCESS_TOKEN

Slack setup checklist:
    1. Enable Socket Mode in your Slack App settings
    2. Create an App-Level Token with connections:write scope
    3. Add Bot Token Scopes: commands, chat:write, im:history, im:read, im:write
    4. Add slash commands: /login /logout /status /workflows /agents etc.

Examples:
    python -m connect.adapters.channels.run slack xoxb-... xapp-...
    python -m connect.adapters.channels.run slack xoxb-... xapp-... http://my-server:8000
    python -m connect.adapters.channels.run slack xoxb-... xapp-... http://my-server:8000 eyJhbGci...

See platforms/slack/SETUP.md for the full setup guide.
"""
import os
import ssl
import sys
from pathlib import Path

import certifi
from slack_sdk import WebClient


# Set token storage path BEFORE any token_storage_file import so the module
# reads the correct path when it is first imported.
os.environ.setdefault('OJ_TOKEN_STORAGE', str(Path(__file__).parent / '.slack_bot_tokens.json'))

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .handlers_registrator import register_handlers
from .state import set_app_config


def main():
    if len(sys.argv) < 3 or sys.argv[1] in ('-h', '--help'):
        logger.info((__doc__ or '').strip())
        return

    bot_token = sys.argv[1]
    app_token = sys.argv[2]
    backend_url = sys.argv[3] if len(sys.argv) > 3 else os.getenv("BACKEND_URL", "http://localhost:8000")
    access_token = sys.argv[4] if len(sys.argv) > 4 else os.getenv("ACCESS_TOKEN")

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

    # Create SSL context using certifi
    ssl_context = ssl.create_default_context(cafile=certifi.where())

    # Create WebClient with SSL override
    client = WebClient(token=bot_token, ssl=ssl_context)

    # Pass the client into Bolt App
    app = App(client=client)
    register_handlers(app)

    logger.info("\n%s", "=" * 60)
    logger.info("OpenJiuwen Slack Bot is running! (Socket Mode)")
    logger.info("%s", "=" * 60)
    logger.info("Press Ctrl+C to stop the bot")
    logger.info("%s\n", "=" * 60)

    SocketModeHandler(app, app_token).start()
