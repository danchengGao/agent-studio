"""
WhatsApp bot launcher — Meta Cloud API + FastAPI webhook server.

Meta calls POST /webhook for every incoming message and GET /webhook to
verify the endpoint during setup.  The bot replies by calling the
Graph API directly (no persistent connection needed).

Usage:
    python -m connect.adapters.channels.run whatsapp <ACCESS_TOKEN> <PHONE_NUMBER_ID> [OPTIONS]
"""
import asyncio
import os
import argparse
from pathlib import Path

# Set token storage path BEFORE any token_storage_file import.
os.environ.setdefault(
    'OJ_TOKEN_STORAGE',
    str(Path(__file__).parent / '.whatsapp_bot_tokens.json'),
)

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, JSONResponse

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .bot import handle_message
from .state import set_app_config
from .whatsapp_api import send_text_message, mark_as_read


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog='connect.adapters.channels.run whatsapp',
        description='Run the OpenJiuwen WhatsApp bot (Meta Cloud API)',
    )
    p.add_argument(
        'access_token',
        help='Meta API permanent access token (from Meta Developer Portal)',
    )
    p.add_argument(
        'phone_number_id',
        help='WhatsApp Phone Number ID (from Meta Developer Portal → App → WhatsApp)',
    )
    p.add_argument(
        '--verify-token',
        default=os.getenv('WHATSAPP_VERIFY_TOKEN', 'openjiuwen_verify'),
        help='Webhook verification token you set in Meta Developer Portal '
             '(default: openjiuwen_verify, env: WHATSAPP_VERIFY_TOKEN)',
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


def create_app(access_token: str, phone_number_id: str, verify_token: str) -> FastAPI:
    app = FastAPI(
        title='OpenJiuwen — WhatsApp Bot',
        description='Meta Cloud API webhook receiver',
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
        asyncio.create_task(_process_payload(body, access_token, phone_number_id))
        return PlainTextResponse(content='OK')

    @app.get('/health')
    async def health() -> JSONResponse:
        return JSONResponse({'status': 'ok', 'platform': 'whatsapp'})

    return app


def main() -> None:
    parser = _build_arg_parser()
    args = parser.parse_args()

    access_token: str = args.access_token
    phone_number_id: str = args.phone_number_id
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
        access_token=access_token,
        phone_number_id=phone_number_id,
    )
    logger.info(
        "Login mode: %s (VITE_ENABLE_NEW_AUTH=%s)",
        'with password' if ENABLE_PASSWORD_LOGIN else 'without password',
        ENABLE_PASSWORD_LOGIN,
    )

    logger.info("\n%s", "=" * 60)
    logger.info("OpenJiuwen WhatsApp Bot is starting...")
    logger.info("   Listening on http://%s:%s/webhook", host, port)
    logger.info("   Register this URL as the Webhook in Meta Developer Portal.")
    logger.info("   Verify token: %s", verify_token)
    logger.info("%s", "=" * 60)
    logger.info("Press Ctrl+C to stop the bot")
    logger.info("%s\n", "=" * 60)

    try:
        import uvicorn
        uvicorn.run(
            create_app(access_token, phone_number_id, verify_token),
            host=host,
            port=port,
        )
    except ImportError as exc:
        raise RuntimeError("uvicorn is not installed. Run: pip install uvicorn") from exc


async def _process_payload(body: dict, access_token: str, phone_number_id: str) -> None:
    """Extract messages from a Meta webhook payload and dispatch them."""
    # Meta payload structure:
    # { "object": "whatsapp_business_account", "entry": [{ "changes": [{ "value": {
    #   "messages": [{ "from": "...", "id": "...", "text": { "body": "..." } }]
    # }}]}]}
    if body.get('object') != 'whatsapp_business_account':
        return

    for entry in body.get('entry', []):
        for change in entry.get('changes', []):
            value = change.get('value', {})
            messages = value.get('messages', [])
            for msg in messages:
                msg_type = msg.get('type')
                if msg_type != 'text':
                    continue

                from_number: str = msg.get('from', '')
                msg_id: str = msg.get('id', '')
                text: str = msg.get('text', {}).get('body', '').strip()

                if not from_number or not text:
                    continue

                mark_as_read(access_token, phone_number_id, msg_id)

                async def say(reply_text: str, _to=from_number) -> None:
                    send_text_message(access_token, phone_number_id, _to, reply_text)

                logger.info("Message from %s: %s", from_number, text[:80])
                await handle_message(from_number, text, say)
