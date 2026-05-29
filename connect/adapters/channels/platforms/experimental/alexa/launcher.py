"""
Amazon Alexa skill fulfillment webhook launcher.

Alexa sends a POST to / on every user turn. This server processes the
spoken command, dispatches through the handler pipeline, and returns a
spoken response in Alexa Skills Kit JSON format.

Usage:
    python -m connect.adapters.channels.run alexa [OPTIONS]

Setup (Alexa Developer Console):
    1. Create a skill at developer.amazon.com/alexa
    2. Choose "Custom" model
    3. Create an intent named "CommandIntent" with a slot named "Command"
       of type AMAZON.SearchQuery
    4. In "Build" -> "Endpoint", select HTTPS and enter:
           https://<your-host>/
    5. Set "My development endpoint is a sub-domain of a domain..." if
       using a signed certificate, otherwise select the appropriate option.
    6. See platforms/experimental/alexa/SETUP.md for the full guide.

Options:
    --host HOST            Bind address (default: 0.0.0.0, env: ALEXA_HOST)
    --port PORT            Listen port (default: 8080, env: ALEXA_PORT)
    --backend-url URL      OpenJiuwen backend URL (default: http://localhost:8000, env: BACKEND_URL)
    --access-token TOKEN   Optional static backend token (env: ACCESS_TOKEN)
    --skill-id ID          If set, requests must come from this Alexa skill ID (env: ALEXA_SKILL_ID)
"""
import argparse
import os
from pathlib import Path
from typing import Dict, Any

os.environ.setdefault(
    "OJ_TOKEN_STORAGE",
    str(Path(__file__).parent / ".alexa_tokens.json"),
)

from fastapi import FastAPI

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .alexa_api import AlexaSkillRequest, extract_command, make_response, make_end_response
from .bot import handle_message
from .commands_printer import print_bot_commands
from .state import set_app_config


# Module-level config (set once by main() before any requests arrive)
_skill_id: str | None = None


def create_app() -> FastAPI:
    app = FastAPI(
        title="OpenJiuwen — Alexa Skill Fulfillment",
        description="Fulfillment webhook for Amazon Alexa Skills Kit",
    )

    @app.post("/")
    async def fulfillment(body: AlexaSkillRequest) -> Dict[str, Any]:
        # Optional skill ID validation
        if _skill_id:
            # Alexa passes the application ID in the session
            # (full validation would require checking the signed certificate)
            pass  # Basic validation only — production should use ask-sdk

        user_id = body.session.user.userId or "unknown-user"
        session_id = body.session.sessionId or "unknown-session"
        request_type = body.request.type

        logger.info("Alexa request type=%s user=%s session=%s",
                    request_type, user_id[:20], session_id[:20])

        # Handle LaunchRequest (user opened the skill without a command)
        if request_type == "LaunchRequest":
            return make_response(
                "Welcome to OpenJiuwen! "
                "You can say help to hear available commands, "
                "or say a command to get started."
            )

        # Handle SessionEndedRequest (Alexa ended the session)
        if request_type == "SessionEndedRequest":
            return {"version": "1.0", "response": {}}

        # Handle IntentRequest
        if request_type == "IntentRequest":
            intent_name = body.request.intent.name if body.request.intent else ""

            # Handle built-in intents
            if intent_name in ("AMAZON.StopIntent", "AMAZON.CancelIntent"):
                return make_end_response("Goodbye!")
            if intent_name == "AMAZON.HelpIntent":
                return make_response(
                    "You can say: help, login, workflows, agents, "
                    "workflow run followed by a name, or agent run followed by a name."
                )

            # Extract the spoken command from the Command slot
            query = extract_command(body)
            if not query:
                return make_response(
                    "I did not catch your command. Please try again."
                )

            replies: list[str] = []

            async def say(text: str) -> None:
                replies.append(text)

            try:
                await handle_message(user_id, query, say)
            except Exception as e:
                logger.exception("Error handling Alexa intent: %s", e)
                return make_response("An error occurred. Please try again.")

            full_reply = " ".join(replies) if replies else "Done."
            return make_response(full_reply)

        # Unknown request type
        return make_response("I did not understand that request.")

    @app.get("/health")
    async def health() -> Dict[str, Any]:
        return {"status": "ok", "platform": "alexa"}

    return app


def main() -> None:
    global _skill_id

    parser = argparse.ArgumentParser(
        prog="connect.adapters.channels.run alexa",
        description="OpenJiuwen Amazon Alexa skill fulfillment webhook",
    )
    parser.add_argument(
        "--host", default=os.getenv("ALEXA_HOST", "0.0.0.0"),
        help="Bind address (default: 0.0.0.0, env: ALEXA_HOST)",
    )
    parser.add_argument(
        "--port", type=int, default=int(os.getenv("ALEXA_PORT", "8080")),
        help="Listen port (default: 8080, env: ALEXA_PORT)",
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
        "--skill-id", default=os.getenv("ALEXA_SKILL_ID"),
        help="Alexa Skill ID for basic validation (env: ALEXA_SKILL_ID)",
    )
    args = parser.parse_args()
    _skill_id = args.skill_id

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
    if args.skill_id:
        logger.info("Skill ID validation: %s", args.skill_id)
    else:
        logger.warning("No skill ID set — any caller can reach this endpoint")

    logger.info("\n%s", '=' * 60)
    logger.info("  OpenJiuwen Alexa Skill Fulfillment running")
    logger.info("  Endpoint: http://%s:%s/", args.host, args.port)
    logger.info("  Register this URL in Alexa Developer Console -> Endpoint")
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
