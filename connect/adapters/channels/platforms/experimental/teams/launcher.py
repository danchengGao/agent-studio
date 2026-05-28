"""
Microsoft Teams bot launcher — Bot Framework + FastAPI webhook server.

Pure backend logic lives in client/; this module handles the Bot Framework
adapter, FastAPI HTTP server, and /api/messages endpoint.

The bot receives webhook POSTs from Azure Bot Service on /api/messages.
For local development, use ngrok or the Bot Framework Emulator.

Usage:
    python -m connect.adapters.channels.run teams <APP_ID> <APP_PASSWORD> [BACKEND_URL] [--port PORT]
"""
import os
import argparse
from pathlib import Path

# Set token storage path BEFORE any token_storage_file import so the module
# reads the correct path when it is first imported.
os.environ.setdefault('OJ_TOKEN_STORAGE', str(Path(__file__).parent / '.teams_bot_tokens.json'))

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, JSONResponse
from botbuilder.core import (
    BotFrameworkAdapter,
    BotFrameworkAdapterSettings,
)
from botbuilder.schema import Activity

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .bot import OJTeamsBot
from .state import set_app_config


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog='connect.adapters.channels.run teams',
        description='Run the OpenJiuwen Microsoft Teams bot',
    )
    p.add_argument('app_id', help='Azure Bot App ID (from Azure Portal / Bot Registration)')
    p.add_argument('app_password', help='Azure Bot App Password / Client Secret')
    p.add_argument(
        '--backend-url',
        default=os.getenv('BACKEND_URL', 'http://localhost:8000'),
        help='OpenJiuwen backend URL (default: http://localhost:8000)',
    )
    p.add_argument(
        '--access-token',
        default=os.getenv('ACCESS_TOKEN'),
        help='Optional static backend access token',
    )
    p.add_argument(
        '--port',
        type=int,
        default=int(os.getenv('PORT', '3978')),
        help='Port to listen on (default: 3978)',
    )
    p.add_argument(
        '--host',
        default=os.getenv('HOST', '0.0.0.0'),
        help='Host to bind to (default: 0.0.0.0)',
    )
    return p


def create_app(app_id: str, app_password: str) -> FastAPI:
    settings = BotFrameworkAdapterSettings(app_id=app_id, app_password=app_password)
    adapter = BotFrameworkAdapter(settings)
    bot = OJTeamsBot()

    async def on_error(context, error: Exception) -> None:
        logger.exception("Unhandled error in bot turn: %s", error)
        await context.send_activity("❌ An unexpected error occurred. Please try again.")

    adapter.on_turn_error = on_error

    app = FastAPI(
        title='OpenJiuwen — Teams Bot',
        description='Azure Bot Framework webhook receiver',
    )

    @app.post('/api/messages')
    async def messages(request: Request) -> PlainTextResponse:
        content_type = request.headers.get('content-type', '')
        if 'application/json' not in content_type:
            return PlainTextResponse(content='Unsupported Media Type', status_code=415)
        try:
            body = await request.json()
        except Exception:
            return PlainTextResponse(content='Invalid JSON', status_code=400)

        activity = Activity().deserialize(body)
        auth_header = request.headers.get('Authorization', '')

        try:
            await adapter.process_activity(activity, auth_header, bot.on_turn)
        except Exception as e:
            logger.exception("Error processing activity: %s", e)
            return PlainTextResponse(content='Internal Server Error', status_code=500)

        return PlainTextResponse(content='', status_code=200)

    @app.get('/health')
    async def health() -> JSONResponse:
        return JSONResponse({'status': 'ok', 'platform': 'teams'})

    return app


def main() -> None:
    parser = _build_arg_parser()
    args = parser.parse_args()

    backend_url: str = args.backend_url
    app_id: str = args.app_id
    app_password: str = args.app_password
    port: int = args.port
    host: str = args.host

    # ── Backend connectivity check ─────────────────────────────────────────
    probe = OpenJiuwenClient(base_url=backend_url)
    if args.access_token:
        probe.set_token(args.access_token)
        logger.info("Using static authentication token")
    try:
        result = health_check(probe)
        logger.info("Connected to OpenJiuwen backend at %s", backend_url)
        logger.info("   Backend status: %s", result)
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

    logger.info("\n%s", "=" * 60)
    logger.info("OpenJiuwen Teams Bot is starting...")
    logger.info("   Listening on http://%s:%s/api/messages", host, port)
    logger.info("   Register this URL as the messaging endpoint in Azure Bot Service.")
    logger.info("%s", "=" * 60)
    logger.info("Press Ctrl+C to stop the bot")
    logger.info("%s\n", "=" * 60)

    try:
        import uvicorn
        uvicorn.run(create_app(app_id, app_password), host=host, port=port)
    except ImportError as exc:
        raise RuntimeError("uvicorn is not installed. Run: pip install uvicorn") from exc
