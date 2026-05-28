"""
Twilio SMS launcher.

Runs a FastAPI HTTP server. Twilio POSTs inbound SMS to /sms.
Replies are sent asynchronously via the Twilio REST API.
Requires a public HTTPS URL (use ngrok for local dev).

Usage:
    python -m connect.adapters.channels.run twilio <ACCOUNT_SID> <AUTH_TOKEN> <FROM_NUMBER> [OPTIONS]

Arguments:
    ACCOUNT_SID    (required) Twilio Account SID (console.twilio.com → Account Info)
    AUTH_TOKEN     (required) Twilio Auth Token  (console.twilio.com → Account Info)
    FROM_NUMBER    (required) Your Twilio phone number in E.164 format (e.g. +15551234567)

Options:
    --backend-url URL         OpenJiuwen backend URL  (default: http://localhost:8000, env: BACKEND_URL)
    --access-token TOKEN      Static backend token — all users share it (env: ACCESS_TOKEN)
    --host HOST               Bind address (default: 0.0.0.0, env: HOST)
    --port PORT               Listen port  (default: 8080, env: PORT)
    --verify-signatures       Validate X-Twilio-Signature on every request (recommended in production)

Endpoints:
    POST /sms      Twilio inbound SMS webhook (register this URL in the Twilio console)
    GET  /health   Health check

Twilio setup:
    1. Create/log in at console.twilio.com
    2. Buy a phone number with SMS capability
    3. Phone Numbers → Manage → Active Numbers → your number
       Set "A MESSAGE COMES IN" webhook to: https://<your-host>/sms  (HTTP POST)
    4. Start ngrok: ngrok http 8080
    5. See platforms/experimental/twilio/SETUP.md for the full guide.

Examples:
    python -m connect.adapters.channels.run twilio AC... token... +15551234567
    python -m connect.adapters.channels.run twilio AC... token... +15551234567 --backend-url http://my-server:8000
    python -m connect.adapters.channels.run twilio AC... token... +15551234567 --verify-signatures --port 8080
"""
import argparse
import asyncio
import os
from pathlib import Path

os.environ.setdefault("OJ_TOKEN_STORAGE", str(Path(__file__).parent / ".twilio_tokens.json"))

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .bot import handle_message
from .commands_printer import print_bot_commands
from .handlers_registrator import register_handlers
from .state import set_app_config
from .twilio_api import TwilioConfig, send_sms, verify_twilio_signature


def create_app(twilio_config: TwilioConfig, verify_sigs: bool) -> FastAPI:
    app = FastAPI(
        title='OpenJiuwen — Twilio SMS',
        description='Twilio inbound SMS webhook receiver',
    )

    @app.post("/sms")
    async def sms_handler(request: Request) -> Response:
        form = await request.form()
        form_data = dict(form)

        if verify_sigs:
            sig = request.headers.get("X-Twilio-Signature", "")
            if not verify_twilio_signature(twilio_config, str(request.url), form_data, sig):
                logger.warning("Invalid Twilio signature — request rejected")
                return Response(content="Forbidden", status_code=403)

        from_number = form_data.get("From", "").strip()
        body = form_data.get("Body", "").strip()

        if not from_number or not body:
            return Response(content="<Response/>", media_type="application/xml")

        loop = asyncio.get_event_loop()

        async def say(text: str) -> None:
            await loop.run_in_executor(None, lambda: send_sms(twilio_config, from_number, text))

        try:
            await handle_message(from_number, body, say)
        except Exception as exc:
            logger.exception("Error handling SMS from %s: %s", from_number, exc)
            try:
                await say("An error occurred. Please try again.")
            except Exception as say_exc:
                logger.warning("Failed to send error reply to %s: %s", from_number, say_exc)

        # Return empty TwiML — reply was already sent via REST API above
        return Response(content="<Response/>", media_type="application/xml")

    @app.get("/health")
    async def health_handler() -> JSONResponse:
        return JSONResponse({"status": "ok", "platform": "twilio"})

    return app


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="connect.adapters.channels.run twilio",
        description="OpenJiuwen Twilio SMS webhook",
    )
    parser.add_argument("account_sid", help="Twilio Account SID")
    parser.add_argument("auth_token", help="Twilio Auth Token")
    parser.add_argument("from_number", help="Your Twilio phone number (E.164, e.g. +15551234567)")
    parser.add_argument("--backend-url", default=os.getenv("BACKEND_URL", "http://localhost:8000"))
    parser.add_argument("--access-token", default=os.getenv("ACCESS_TOKEN"))
    parser.add_argument("--host", default=os.getenv("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8080")))
    parser.add_argument("--verify-signatures", action="store_true",
                        help="Validate X-Twilio-Signature on every inbound request")
    args = parser.parse_args()

    twilio_config = TwilioConfig(
        account_sid=args.account_sid,
        auth_token=args.auth_token,
        from_number=args.from_number,
    )

    probe = OpenJiuwenClient(base_url=args.backend_url)
    if args.access_token:
        probe.set_token(args.access_token)
        logger.info("Using static backend authentication token")
    try:
        result = health_check(probe)
        logger.info("Connected to OpenJiuwen backend at %s — %s", args.backend_url, result)
    except Exception as exc:
        logger.warning("backend unreachable at %s: %s", args.backend_url, exc)

    set_app_config(
        backend_url=args.backend_url,
        static_token=args.access_token,
        enable_password_login=ENABLE_PASSWORD_LOGIN,
    )
    register_handlers()

    logger.info("\n%s", '=' * 60)
    logger.info("  OpenJiuwen Twilio SMS webhook running")
    logger.info("  POST http://%s:%s/sms", args.host, args.port)
    logger.info("  Register this URL in Twilio → Phone Numbers → Webhooks")
    if args.verify_signatures:
        logger.info("  Signature verification: ENABLED")
    logger.info('%s', '=' * 60)
    print_bot_commands()
    logger.info("Press Ctrl+C to stop\n")

    try:
        import uvicorn
        uvicorn.run(
            create_app(twilio_config, args.verify_signatures),
            host=args.host,
            port=args.port,
        )
    except ImportError as exc:
        raise RuntimeError("uvicorn is not installed. Run: pip install uvicorn") from exc
