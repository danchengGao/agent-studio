"""
Facebook Messenger bot launcher — Meta Messenger Platform + FastAPI webhook server.

Meta calls POST /webhook for every incoming message and GET /webhook to
verify the endpoint during setup. The bot replies by calling the
Graph API directly (no persistent connection needed).

Usage:
    python -m connect.adapters.channels.run messenger <PAGE_ACCESS_TOKEN> [OPTIONS]

Setup:
    1. Create a Meta App at developers.facebook.com
    2. Add the Messenger product to your app
    3. Generate a Page Access Token for your Facebook Page
    4. Set webhook URL to https://<your-host>/webhook
    5. Set verify token (--verify-token) and subscribe to 'messages' events
    6. See platforms/experimental/messenger/SETUP.md for the full guide.

Options:
    PAGE_ACCESS_TOKEN    Meta Page Access Token (positional, required)
    --verify-token       Webhook verification token (default: openjiuwen_verify, env: MESSENGER_VERIFY_TOKEN)
    --backend-url        OpenJiuwen backend URL (default: http://localhost:8000, env: BACKEND_URL)
    --access-token-backend  Optional static backend token (env: ACCESS_TOKEN)
    --host               Bind address (default: 0.0.0.0, env: HOST)
    --port               Listen port (default: 8080, env: PORT)
"""
import asyncio
import os
import argparse
from pathlib import Path

# Set token storage path BEFORE any token_storage_file import.
os.environ.setdefault(
    'OJ_TOKEN_STORAGE',
    str(Path(__file__).parent / '.messenger_tokens.json'),
)

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, JSONResponse

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .bot import handle_message
from .commands_printer import print_bot_commands
from .messenger_api import send_text_message, mark_as_seen
from .state import set_app_config


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog='connect.adapters.channels.run messenger',
        description='Run the OpenJiuwen Facebook Messenger bot (Meta Messenger Platform)',
    )
    p.add_argument(
        'page_access_token',
        help='Meta Page Access Token (from Meta Developer Portal → Messenger → Token Generation)',
    )
    p.add_argument(
        '--verify-token',
        default=os.getenv('MESSENGER_VERIFY_TOKEN', 'openjiuwen_verify'),
        help='Webhook verification token you set in Meta Developer Portal '
             '(default: openjiuwen_verify, env: MESSENGER_VERIFY_TOKEN)',
    )
    p.add_argument(
        '--backend-url',
        default=os.getenv('BACKEND_URL', 'http://localhost:8000'),
        help='OpenJiuwen backend URL (default: http://localhost:8000)',
    )
    p.add_argument(
        '--access-token-backend',
        default=os.getenv('ACCESS_TOKEN'),
        help='Optional static backend access token (env: ACCESS_TOKEN)',
    )
    p.add_argument(
        '--port',
        type=int,
        default=int(os.getenv('PORT', '8080')),
        help='Port to listen on (default: 8080)',
    )
    p.add_argument(
        '--host',
        default=os.getenv('HOST', '0.0.0.0'),
        help='Host to bind to (default: 0.0.0.0)',
    )
    return p


def create_app(page_access_token: str, verify_token: str) -> FastAPI:
    app = FastAPI(
        title='OpenJiuwen — Facebook Messenger Bot',
        description='Meta Messenger Platform webhook receiver',
    )

    @app.get('/webhook')
    async def webhook_verify(request: Request) -> PlainTextResponse:
        """GET /webhook — Meta webhook verification challenge."""
        mode = request.query_params.get('hub.mode')
        token = request.query_params.get('hub.verify_token')
        challenge = request.query_params.get('hub.challenge', '')
        if mode == 'subscribe' and token == verify_token:
            logger.info("Webhook verified successfully.")
            return PlainTextResponse(content=challenge)
        logger.warning("Webhook verification failed (token mismatch).")
        return PlainTextResponse(content='Forbidden', status_code=403)

    @app.post('/webhook')
    async def webhook_receive(request: Request) -> PlainTextResponse:
        """POST /webhook — incoming messages from Meta."""
        try:
            body = await request.json()
        except Exception:
            return PlainTextResponse(content='Invalid JSON', status_code=400)

        # Always respond 200 immediately — Meta retries on non-200.
        asyncio.create_task(_process_payload(body, page_access_token))
        return PlainTextResponse(content='OK')

    @app.get('/health')
    async def health() -> JSONResponse:
        return JSONResponse({'status': 'ok', 'platform': 'messenger'})

    return app


def main() -> None:
    parser = _build_arg_parser()
    args = parser.parse_args()

    page_access_token: str = args.page_access_token
    verify_token: str = args.verify_token
    backend_url: str = args.backend_url
    port: int = args.port
    host: str = args.host

    # ── Backend connectivity check ─────────────────────────────────────────
    probe = OpenJiuwenClient(base_url=backend_url)
    if args.access_token_backend:
        probe.set_token(args.access_token_backend)
        logger.info("Using static backend authentication token")
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
        page_access_token=page_access_token,
    )
    logger.info(
        "Login mode: %s (VITE_ENABLE_NEW_AUTH=%s)",
        'with password' if ENABLE_PASSWORD_LOGIN else 'without password',
        ENABLE_PASSWORD_LOGIN,
    )

    logger.info("\n%s", "=" * 60)
    logger.info("OpenJiuwen Facebook Messenger Bot is starting...")
    logger.info("   Listening on http://%s:%s/webhook", host, port)
    logger.info("   Register this URL as the Webhook in Meta Developer Portal.")
    logger.info("   Verify token: %s", verify_token)
    logger.info("%s", "=" * 60)
    print_bot_commands()
    logger.info("%s", "=" * 60)
    logger.info("Press Ctrl+C to stop the bot")
    logger.info("%s\n", "=" * 60)

    try:
        import uvicorn
        uvicorn.run(create_app(page_access_token, verify_token), host=host, port=port)
    except ImportError as exc:
        raise RuntimeError("uvicorn is not installed. Run: pip install uvicorn") from exc


async def _process_payload(body: dict, page_access_token: str) -> None:
    """Extract messages from a Meta Messenger webhook payload and dispatch them."""
    # Messenger payload structure:
    # { "object": "page", "entry": [{ "messaging": [{
    #   "sender": { "id": "PSID" },
    #   "message": { "text": "hello" }
    # }]}]}
    if body.get('object') != 'page':
        return

    for entry in body.get('entry', []):
        for messaging_event in entry.get('messaging', []):
            sender = messaging_event.get('sender', {})
            psid: str = sender.get('id', '')
            if not psid:
                continue

            message = messaging_event.get('message', {})
            if message.get('is_echo'):
                continue

            text: str = message.get('text', '').strip()
            if not text:
                continue

            loop = asyncio.get_event_loop()
            loop.run_in_executor(None, lambda t=psid: mark_as_seen(page_access_token, t))

            async def say(reply_text: str, _to=psid) -> None:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: send_text_message(page_access_token, _to, reply_text)
                )

            logger.info("Message from PSID %s: %s", psid, text[:80])
            await handle_message(psid, text, say)
