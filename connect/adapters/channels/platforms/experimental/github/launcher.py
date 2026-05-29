"""
GitHub webhook launcher.

Receives issue_comment webhook events from GitHub.
Users control OpenJiuwen by commenting slash commands on issues and PRs.

Usage:
    python -m connect.adapters.channels.run github <GITHUB_TOKEN> [OPTIONS]

Arguments:
    GITHUB_TOKEN   (required) GitHub Personal Access Token or GitHub App token
                              Needs repo scope to post comments.
                              env: GITHUB_TOKEN

Options:
    --webhook-secret SECRET   HMAC secret set in GitHub webhook settings (env: GITHUB_WEBHOOK_SECRET)
    --backend-url URL         OpenJiuwen backend URL (default: http://localhost:8000, env: BACKEND_URL)
    --access-token TOKEN      Static backend token — all users share it (env: ACCESS_TOKEN)
    --host HOST               Bind address (default: 0.0.0.0, env: HOST)
    --port PORT               Listen port  (default: 8080, env: PORT)

Endpoints:
    POST /webhook   GitHub webhook receiver (register this URL in repo/org settings)
    GET  /health    Health check

GitHub webhook setup:
    1. Go to your repo → Settings → Webhooks → Add webhook
    2. Payload URL: https://<your-host>/webhook
    3. Content type: application/json
    4. Secret: any string (pass it as --webhook-secret)
    5. Events: select "Issue comments"
    6. Start ngrok: ngrok http 8080
    7. See platforms/experimental/github/SETUP.md for the full guide.

Commands (comment on any issue or PR):
    /login /logout /status /cancel /health /help
    /workflows   /workflows search <q>   /workflow run <id>
    /agents      /agents search <q>      /agent run <id> <msg>
    /agent chat <id>    /skip

Examples:
    python -m connect.adapters.channels.run github ghp_...
    python -m connect.adapters.channels.run github ghp_... --webhook-secret mysecret
    python -m connect.adapters.channels.run github ghp_... --backend-url http://my-server:8000
"""
import argparse
import asyncio
import json
import os
from pathlib import Path

os.environ.setdefault("OJ_TOKEN_STORAGE", str(Path(__file__).parent / ".github_tokens.json"))

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .bot import handle_command
from .commands_printer import print_bot_commands
from .github_api import GitHubConfig, parse_issue_comment, post_comment, verify_github_signature, extract_command
from .handlers_registrator import register_handlers
from .state import set_app_config


_gh_config: GitHubConfig | None = None


def create_app() -> FastAPI:
    app = FastAPI(
        title="OpenJiuwen — GitHub Webhook",
        description="Slash command bot via GitHub issue/PR comments",
    )

    @app.post("/webhook")
    async def webhook(request: Request, x_hub_signature_256: str = Header(None)):
        body = await request.body()

        # Verify signature
        if _gh_config and _gh_config.webhook_secret:
            if not verify_github_signature(_gh_config.webhook_secret, body, x_hub_signature_256 or ""):
                logger.warning("Invalid GitHub webhook signature — request rejected")
                raise HTTPException(status_code=401, detail="Invalid signature")

        event_type = request.headers.get("X-GitHub-Event", "")
        if event_type not in ("issue_comment", "pull_request_review_comment"):
            return JSONResponse({"status": "ignored", "event": event_type})

        try:
            payload = json.loads(body)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid JSON") from e

        event = parse_issue_comment(payload)
        if not event:
            return JSONResponse({"status": "ignored", "reason": "not a new comment or bot sender"})

        command = extract_command(event.body)
        if not command:
            return JSONResponse({"status": "ignored", "reason": "no slash command found"})

        logger.info("Command from @%s on %s#%d: /%s",
                    event.username, event.repo_full_name, event.issue_number, command[:60])

        async def say(text: str) -> None:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: post_comment(_gh_config, event.repo_full_name, event.issue_number, text),
            )

        try:
            await handle_command(event.username, command, say)
        except Exception as exc:
            logger.exception("Error handling command from @%s: %s", event.username, exc)
            try:
                await say(f"An error occurred processing your command: {exc}")
            except Exception as e:
                raise e

        return JSONResponse({"status": "ok"})

    @app.get("/health")
    async def health():
        return {"status": "ok", "platform": "github"}

    return app


def main() -> None:
    global _gh_config

    parser = argparse.ArgumentParser(
        prog="connect.adapters.channels.run github",
        description="OpenJiuwen GitHub slash command bot",
    )
    parser.add_argument("github_token",
                        nargs="?",
                        default=os.getenv("GITHUB_TOKEN"),
                        help="GitHub Personal Access Token (env: GITHUB_TOKEN)")
    parser.add_argument("--webhook-secret", default=os.getenv("GITHUB_WEBHOOK_SECRET", ""),
                        help="HMAC secret for webhook signature verification (env: GITHUB_WEBHOOK_SECRET)")
    parser.add_argument("--backend-url", default=os.getenv("BACKEND_URL", "http://localhost:8000"))
    parser.add_argument("--access-token", default=os.getenv("ACCESS_TOKEN"))
    parser.add_argument("--host", default=os.getenv("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8080")))
    args = parser.parse_args()

    if not args.github_token:
        parser.error("GITHUB_TOKEN is required (argument or env var)")

    _gh_config = GitHubConfig(
        github_token=args.github_token,
        webhook_secret=args.webhook_secret,
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

    if args.webhook_secret:
        logger.info("Webhook signature verification: ENABLED")
    else:
        logger.warning("No webhook secret set — endpoint is unauthenticated")

    logger.info("\n%s", '=' * 60)
    logger.info("  OpenJiuwen GitHub Bot running")
    logger.info("  POST http://%s:%s/webhook", args.host, args.port)
    logger.info("  Register this URL in GitHub → Repo Settings → Webhooks")
    logger.info('%s', '=' * 60)
    print_bot_commands()
    logger.info("Press Ctrl+C to stop\n")

    try:
        import uvicorn
        uvicorn.run(create_app(), host=args.host, port=args.port)
    except ImportError as exc:
        raise RuntimeError("uvicorn is not installed. Run: pip install uvicorn") from exc
