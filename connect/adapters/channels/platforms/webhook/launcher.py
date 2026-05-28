"""
Webhook server launcher.
Exposes OpenJiuwen workflows and agents as REST endpoints.

Any HTTP client, automation tool (n8n, Zapier, Make), CI pipeline, or
script can trigger workflows and agents by posting JSON to this server.

Unlike the bot platforms, this server is stateless — every request carries
all the information needed (workflow/agent ID, inputs, optional auth token).
"""
import argparse
import os
import sys

from pathlib import Path

# Set token storage path before any token_storage_file import.
# Webhook has no per-user sessions, but the module still needs a valid path.
os.environ.setdefault('OJ_TOKEN_STORAGE', str(Path(__file__).parent / '.webhook_tokens.json'))

from openjiuwen.core.common.logging import logger

from connect.client import OpenJiuwenClient
from connect.client.general.health_check import health_check
from .auth import configure
from .app import create_app


def main():
    parser = argparse.ArgumentParser(
        description="OpenJiuwen Webhook Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m connect.adapters.channels.run webhook
  python -m connect.adapters.channels.run webhook --port 9000 --backend-url http://my-server:8000
  python -m connect.adapters.channels.run webhook --token eyJhbGci... --space-id ws_abc123 --api-key secret123
        """,
    )
    parser.add_argument(
        "--host", default=os.getenv("WEBHOOK_HOST", "0.0.0.0"),
        help="Host to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port", type=int, default=int(os.getenv("WEBHOOK_PORT", "8080")),
        help="Port to listen on (default: 8080)",
    )
    parser.add_argument(
        "--backend-url", default=os.getenv("BACKEND_URL", "http://localhost:8000"),
        help="OpenJiuwen backend URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--token", default=os.getenv("ACCESS_TOKEN"),
        help="Static backend token used when requests don't supply their own",
    )
    parser.add_argument(
        "--space-id", default=os.getenv("SPACE_ID"),
        help="Static space ID used when requests don't supply their own",
    )
    parser.add_argument(
        "--api-key", default=os.getenv("WEBHOOK_API_KEY"),
        help="If set, every request must include X-API-Key: <key>",
    )
    args = parser.parse_args()

    # Configure auth module before the app handles any requests
    configure(
        backend_url=args.backend_url,
        static_token=args.token,
        static_space_id=args.space_id,
        api_key=args.api_key,
    )

    # Test backend connectivity
    probe = OpenJiuwenClient(base_url=args.backend_url)
    if args.token:
        probe.set_token(args.token)
        logger.info("Using static backend token")
    if args.space_id:
        logger.info("Using static space ID: %s", args.space_id)
    try:
        health = health_check(probe)
        logger.info("Connected to OpenJiuwen backend at %s", args.backend_url)
        logger.info("   Backend status: %s", health)
    except Exception as e:
        logger.warning("Could not connect to backend at %s: %s", args.backend_url, e)
        logger.info("   Server will start but API calls may fail.")

    if args.api_key:
        logger.info("Webhook API key protection enabled")
    else:
        logger.warning("No API key set — server is open to anyone who can reach it")

    app = create_app()

    logger.info("\n%s", '=' * 60)
    logger.info("OpenJiuwen Webhook Server running on http://%s:%s", args.host, args.port)
    logger.info("   Docs: http://%s:%s/docs", args.host, args.port)
    logger.info('%s', '=' * 60)
    logger.info("Press Ctrl+C to stop")
    logger.info('%s\n', '=' * 60)

    try:
        import uvicorn
        uvicorn.run(app, host=args.host, port=args.port)
    except ImportError as exc:
        error = "uvicorn is not installed. Run: pip install uvicorn"
        logger.error(error)
        raise RuntimeError(error) from exc
