"""
Email bot launcher — IMAP polling + SMTP reply.

Polls an IMAP inbox for unread messages and dispatches each one through
the same handler pipeline as the other channel adapters.

Usage:
    python -m connect.adapters.channels.run email <IMAP_HOST> <SMTP_HOST> <EMAIL_ADDRESS> <PASSWORD> [OPTIONS]

Options:
    --imap-port PORT       IMAP port (default: 993, env: IMAP_PORT)
    --smtp-port PORT       SMTP port, uses STARTTLS (default: 587, env: SMTP_PORT)
    --backend-url URL      OpenJiuwen backend URL (default: http://localhost:8000, env: BACKEND_URL)
    --access-token TOKEN   Optional static backend token (env: ACCESS_TOKEN)
    --poll-interval N      Seconds between inbox polls (default: 10, env: EMAIL_POLL_INTERVAL)
"""
import argparse
import asyncio
import os
from pathlib import Path

# Set token storage path BEFORE any token_storage_file import.
os.environ.setdefault("OJ_TOKEN_STORAGE", str(Path(__file__).parent / ".email_tokens.json"))

from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.config import ENABLE_PASSWORD_LOGIN
from connect.client.general.health_check import health_check
from .bot import handle_message
from .commands_printer import print_bot_commands
from .email_api import IMAPConfig, SMTPConfig, fetch_unread_messages, extract_command, send_reply, strip_markdown
from .state import set_app_config


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="connect.adapters.channels.run email",
        description="Run the OpenJiuwen Email bot (IMAP polling + SMTP replies)",
    )
    p.add_argument("imap_host", help="IMAP server hostname (e.g. imap.gmail.com)")
    p.add_argument("smtp_host", help="SMTP server hostname (e.g. smtp.gmail.com)")
    p.add_argument("email_address", help="Email address the bot monitors and replies from")
    p.add_argument("password", help="Email account password (or app-specific password)")
    p.add_argument(
        "--imap-port",
        type=int,
        default=int(os.getenv("IMAP_PORT", "993")),
        help="IMAP SSL port (default: 993, env: IMAP_PORT)",
    )
    p.add_argument(
        "--smtp-port",
        type=int,
        default=int(os.getenv("SMTP_PORT", "587")),
        help="SMTP STARTTLS port (default: 587, env: SMTP_PORT)",
    )
    p.add_argument(
        "--backend-url",
        default=os.getenv("BACKEND_URL", "http://localhost:8000"),
        help="OpenJiuwen backend URL (default: http://localhost:8000, env: BACKEND_URL)",
    )
    p.add_argument(
        "--access-token",
        default=os.getenv("ACCESS_TOKEN"),
        help="Optional static backend access token (env: ACCESS_TOKEN)",
    )
    p.add_argument(
        "--poll-interval",
        type=int,
        default=int(os.getenv("EMAIL_POLL_INTERVAL", "10")),
        help="Seconds between inbox polls (default: 10, env: EMAIL_POLL_INTERVAL)",
    )
    return p


async def _poll_loop(
    imap_config: IMAPConfig,
    smtp_config: SMTPConfig,
    poll_interval: int,
) -> None:
    """Main polling loop — runs forever until interrupted."""
    logger.info("Starting poll loop (interval=%ds)", poll_interval)
    while True:
        try:
            messages = fetch_unread_messages(imap_config)
            for inbound in messages:
                command = extract_command(inbound.body)
                if not command:
                    logger.debug("No command found in email from %s — skipping", inbound.from_address)
                    continue

                logger.info("Command from %s: %s", inbound.from_address, command[:80])

                # Build a reply-sending closure capturing this email's metadata.
                def make_say(to_addr, subject, msg_id):
                    async def say(reply_text: str) -> None:
                        send_reply(
                            smtp_config,
                            to_address=to_addr,
                            original_subject=subject,
                            body=strip_markdown(reply_text),
                            in_reply_to=msg_id,
                        )
                    return say

                say = make_say(inbound.from_address, inbound.subject, inbound.message_id)

                try:
                    await handle_message(inbound.from_address, command, say)
                except Exception as e:
                    logger.exception("Error handling email from %s: %s", inbound.from_address, e)

        except Exception as e:
            logger.error("Poll iteration error: %s", e)

        await asyncio.sleep(poll_interval)


def main() -> None:
    parser = _build_arg_parser()
    args = parser.parse_args()

    # ── Backend connectivity check ─────────────────────────────────────────
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
        logger.info("   Bot will continue but API calls may fail.")

    set_app_config(
        backend_url=args.backend_url,
        enable_password_login=ENABLE_PASSWORD_LOGIN,
    )
    logger.info(
        "Login mode: %s (VITE_ENABLE_NEW_AUTH=%s)",
        'with password' if ENABLE_PASSWORD_LOGIN else 'without password',
        ENABLE_PASSWORD_LOGIN,
    )

    imap_config = IMAPConfig(
        host=args.imap_host,
        port=args.imap_port,
        username=args.email_address,
        password=args.password,
    )
    smtp_config = SMTPConfig(
        host=args.smtp_host,
        port=args.smtp_port,
        username=args.email_address,
        password=args.password,
        from_address=args.email_address,
    )

    logger.info("\n%s", "=" * 60)
    logger.info("  OpenJiuwen Email Bot is running!")
    logger.info("  Monitoring: %s", args.email_address)
    logger.info("  IMAP: %s:%s", args.imap_host, args.imap_port)
    logger.info("  SMTP: %s:%s", args.smtp_host, args.smtp_port)
    logger.info("  Poll interval: %ss", args.poll_interval)
    logger.info("%s", "=" * 60)
    print_bot_commands()
    logger.info("%s", "=" * 60)
    logger.info("Press Ctrl+C to stop")
    logger.info("%s\n", "=" * 60)

    try:
        asyncio.run(_poll_loop(imap_config, smtp_config, args.poll_interval))
    except KeyboardInterrupt:
        logger.info("\nBot stopped.")
