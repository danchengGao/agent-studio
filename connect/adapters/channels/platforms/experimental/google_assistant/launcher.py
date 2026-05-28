"""
Google Assistant fulfillment webhook launcher.

Google Assistant sends a POST to /fulfillment on every user turn.
This server processes the text, dispatches through the handler pipeline,
and returns a spoken response in Google's Actions SDK v3 format.

Usage:
    python -m connect.adapters.channels.run google_assistant [OPTIONS]

Setup (Actions Builder):
    1. Create a project at console.actions.google.com
    2. In "Develop" → "Webhook", set the fulfillment URL to:
           https://<your-host>/fulfillment
    3. Create a main scene with a free-form text slot so Google captures
       everything the user says and sends it to the webhook.
    4. See platforms/experimental/google_assistant/SETUP.md for the full guide.

Options:
    --host HOST            Bind address (default: 0.0.0.0, env: GA_HOST)
    --port PORT            Listen port (default: 8080, env: GA_PORT)
    --backend-url URL      OpenJiuwen backend URL (default: http://localhost:8000, env: BACKEND_URL)
    --access-token TOKEN   Optional static backend token (env: ACCESS_TOKEN)
    --api-key KEY          If set, requests must include X-API-Key header (env: GA_API_KEY)
"""
import argparse
import os
from pathlib import Path

os.environ.setdefault(
    "OJ_TOKEN_STORAGE",
    str(Path(__file__).parent / ".google_assistant_tokens.json"),
)

from fastapi import FastAPI, HTTPException, Request

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .assistant_api import FulfillmentRequest, make_response
from .bot import handle_message
from .commands_printer import print_bot_commands
from .state import set_app_config


# Module-level config (set once by main() before any requests arrive)
_api_key: str | None = None


def create_app() -> FastAPI:
    app = FastAPI(
        title="OpenJiuwen — Google Assistant Fulfillment",
        description="Fulfillment webhook for Google Actions SDK v3",
    )

    @app.post("/fulfillment")
    async def fulfillment(request: Request, body: FulfillmentRequest):
        # Optional API key protection
        if _api_key:
            key_header = request.headers.get("X-API-Key", "")
            if key_header != _api_key:
                raise HTTPException(status_code=401, detail="Invalid API key")

        session_id = body.session.id or "unknown-session"
        query = body.intent.query.strip()

        logger.info("Turn from session=%s handler=%s query=%s",
                    session_id, body.handler.name, query[:80])

        if not query:
            return make_response(session_id, "I didn't catch that. Please try again.")

        # Collect all say() calls made during handling
        replies: list[str] = []

        async def say(text: str) -> None:
            replies.append(text)

        try:
            await handle_message(session_id, query, say)
        except Exception as e:
            logger.exception("Error handling fulfillment: %s", e)
            return make_response(session_id, "An error occurred. Please try again.")

        full_reply = "\n\n".join(replies) if replies else "Done."
        return make_response(session_id, full_reply)

    @app.get("/health")
    async def health():
        return {"status": "ok", "platform": "google_assistant"}

    return app


def main() -> None:
    global _api_key

    parser = argparse.ArgumentParser(
        prog="connect.adapters.channels.run google_assistant",
        description="OpenJiuwen Google Assistant fulfillment webhook",
    )
    parser.add_argument(
        "--host", default=os.getenv("GA_HOST", "0.0.0.0"),
        help="Bind address (default: 0.0.0.0, env: GA_HOST)",
    )
    parser.add_argument(
        "--port", type=int, default=int(os.getenv("GA_PORT", "8080")),
        help="Listen port (default: 8080, env: GA_PORT)",
    )
    parser.add_argument(
        "--backend-url", default=os.getenv("BACKEND_URL", "http://localhost:8000"),
        help="OpenJiuwen backend URL (default: http://localhost:8000, env: BACKEND_URL)",
    )
    parser.add_argument(
        "--access-token", default=os.getenv("ACCESS_TOKEN"),
        help="Optional static backend token (env: ACCESS_TOKEN)",
    )
    parser.add_argument(
        "--api-key", default=os.getenv("GA_API_KEY"),
        help="Protect fulfillment with X-API-Key header (env: GA_API_KEY)",
    )
    args = parser.parse_args()
    _api_key = args.api_key

    probe = OpenJiuwenClient(base_url=args.backend_url)
    if args.access_token:
        probe.set_token(args.access_token)
        logger.info("Using static backend authentication token")
    try:
        result = health_check(probe)
        logger.info("Connected to OpenJiuwen backend at %s", args.backend_url)
        logger.info("   Backend status: %s", result)
    except Exception as e:
        logger.warning("Could not connect to backend at %s: %s", args.backend_url, e)
        logger.info("   Server will start but API calls may fail.")

    set_app_config(
        backend_url=args.backend_url,
        enable_password_login=ENABLE_PASSWORD_LOGIN,
    )
    logger.info(
        "Login mode: %s (VITE_ENABLE_NEW_AUTH=%s)",
        'with password' if ENABLE_PASSWORD_LOGIN else 'without password',
        ENABLE_PASSWORD_LOGIN,
    )
    if args.api_key:
        logger.info("API key protection enabled")
    else:
        logger.warning("No API key set — fulfillment endpoint is open")

    logger.info("\n%s", '=' * 60)
    logger.info("  OpenJiuwen Google Assistant Fulfillment running")
    logger.info("  Endpoint: http://%s:%s/fulfillment", args.host, args.port)
    logger.info("  Register this URL in Google Actions Console → Webhook")
    logger.info('%s', '=' * 60)
    print_bot_commands()
    logger.info('%s', '=' * 60)
    logger.info("Press Ctrl+C to stop")
    logger.info('%s\n', '=' * 60)

    try:
        import uvicorn
        uvicorn.run(create_app(), host=args.host, port=args.port)
    except ImportError as exc:
        raise RuntimeError("uvicorn is not installed. Run: pip install uvicorn") from exc
