"""
WeChat Official Account bot launcher — FastAPI webhook server.

WeChat sends a GET to /webhook to verify the server, then POST for messages.
Messages are received as XML and replies are sent synchronously in the
HTTP response body.

Usage:
    python -m connect.adapters.channels.run wechat <WECHAT_TOKEN> <APP_ID> <APP_SECRET> [OPTIONS]

Setup:
    1. Register an Official Account at mp.weixin.qq.com
    2. In Developer Settings, set server URL to https://<your-host>/webhook
    3. Set the token (WECHAT_TOKEN) — used for signature verification
    4. Enter your AppID and AppSecret
    5. See platforms/wechat/SETUP.md for the full guide.

Options:
    WECHAT_TOKEN    Verification token set in WeChat Official Account settings (positional, required)
    APP_ID          WeChat AppID (positional, required)
    APP_SECRET      WeChat AppSecret (positional, required)
    --backend-url   OpenJiuwen backend URL (default: http://localhost:8000, env: BACKEND_URL)
    --access-token-backend  Optional static backend token (env: ACCESS_TOKEN)
    --host          Bind address (default: 0.0.0.0, env: HOST)
    --port          Listen port (default: 8080, env: PORT)
"""
import asyncio
import os
import argparse
from pathlib import Path

# Set token storage path BEFORE any token_storage_file import.
os.environ.setdefault(
    'OJ_TOKEN_STORAGE',
    str(Path(__file__).parent / '.wechat_tokens.json'),
)

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, JSONResponse, Response

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .bot import handle_message
from .commands_printer import print_bot_commands
from .state import set_app_config
from .wechat_api import (
    verify_signature,
    parse_xml_message,
    build_text_reply,
    send_customer_service_message,
)


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog='connect.adapters.channels.run wechat',
        description='Run the OpenJiuwen WeChat Official Account bot',
    )
    p.add_argument(
        'wechat_token',
        help='WeChat verification token set in Official Account developer settings',
    )
    p.add_argument(
        'app_id',
        help='WeChat AppID (from Official Account settings)',
    )
    p.add_argument(
        'app_secret',
        help='WeChat AppSecret (from Official Account settings)',
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


def create_app(wechat_token: str, app_id: str, app_secret: str) -> FastAPI:
    app = FastAPI(
        title='OpenJiuwen — WeChat Official Account Bot',
        description='WeChat Open Platform XML webhook receiver',
    )

    @app.get('/webhook')
    async def webhook_verify(request: Request) -> PlainTextResponse:
        """GET /webhook — WeChat server verification."""
        signature = request.query_params.get('signature', '')
        timestamp = request.query_params.get('timestamp', '')
        nonce = request.query_params.get('nonce', '')
        echostr = request.query_params.get('echostr', '')

        if verify_signature(wechat_token, timestamp, nonce, signature):
            logger.info("WeChat server verification succeeded.")
            return PlainTextResponse(content=echostr)
        logger.warning("WeChat server verification failed (signature mismatch).")
        return PlainTextResponse(content='Forbidden', status_code=403)

    @app.post('/webhook')
    async def webhook_receive(request: Request) -> Response:
        """POST /webhook — incoming WeChat messages (XML body)."""
        # Verify signature
        signature = request.query_params.get('signature', '')
        timestamp = request.query_params.get('timestamp', '')
        nonce = request.query_params.get('nonce', '')
        if not verify_signature(wechat_token, timestamp, nonce, signature):
            logger.warning("Incoming message failed signature check.")
            return PlainTextResponse(content='Forbidden', status_code=403)

        xml_body = await request.body()
        msg = parse_xml_message(xml_body)

        msg_type = msg.get('MsgType', '')
        if msg_type != 'text':
            return PlainTextResponse(content='')

        open_id: str = msg.get('FromUserName', '')
        to_user: str = msg.get('ToUserName', '')  # Official Account ID
        text: str = msg.get('Content', '').strip()

        if not open_id or not text:
            return PlainTextResponse(content='')

        logger.info("Message from OpenID %s: %s", open_id, text[:80])

        # Collect the first reply synchronously; route extras via Customer Service API.
        reply_holder: list[str] = []

        async def say(reply_text: str) -> None:
            if not reply_holder:
                reply_holder.append(reply_text)
            else:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda t=reply_text: send_customer_service_message(app_id, app_secret, open_id, t)
                )

        await handle_message(open_id, text, say)

        if reply_holder:
            xml_reply = build_text_reply(open_id, to_user, reply_holder[0])
            return Response(content=xml_reply, media_type='application/xml')
        return PlainTextResponse(content='')

    @app.get('/health')
    async def health() -> JSONResponse:
        return JSONResponse({'status': 'ok', 'platform': 'wechat'})

    return app


def main() -> None:
    parser = _build_arg_parser()
    args = parser.parse_args()

    wechat_token: str = args.wechat_token
    app_id: str = args.app_id
    app_secret: str = args.app_secret
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
        wechat_token=wechat_token,
        app_id=app_id,
        app_secret=app_secret,
    )
    logger.info(
        "Login mode: %s (VITE_ENABLE_NEW_AUTH=%s)",
        'with password' if ENABLE_PASSWORD_LOGIN else 'without password',
        ENABLE_PASSWORD_LOGIN,
    )

    logger.info("\n%s", "=" * 60)
    logger.info("OpenJiuwen WeChat Official Account Bot is starting...")
    logger.info("   Listening on http://%s:%s/webhook", host, port)
    logger.info("   Register this URL in WeChat Official Account Developer Settings.")
    logger.info("   WeChat Token: %s", wechat_token)
    logger.info("   AppID: %s", app_id)
    logger.info("%s", "=" * 60)
    print_bot_commands()
    logger.info("%s", "=" * 60)
    logger.info("Press Ctrl+C to stop the bot")
    logger.info("%s\n", "=" * 60)

    try:
        import uvicorn
        uvicorn.run(create_app(wechat_token, app_id, app_secret), host=host, port=port)
    except ImportError as exc:
        raise RuntimeError("uvicorn is not installed. Run: pip install uvicorn") from exc
