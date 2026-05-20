from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from connect.client.auth.token_storage import get_user_token
from ...auth.commands_printer import SECTIONS as AUTH_SECTIONS
from ...workflows.commands_printer import SECTIONS as WORKFLOW_SECTIONS
from ...agents.commands_printer import SECTIONS as AGENT_SECTIONS
from ..commands_printer import SECTIONS as GENERAL_SECTIONS


def _format_sections(sections):
    lines = []
    for title, commands in sections:
        lines.append(f"{title}:")
        for cmd, desc in commands:
            lines.append(f"{cmd} - {desc}")
        lines.append("")
    return "\n".join(lines).rstrip()


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Welcome message - /start"""
    user_id = update.effective_user.id
    logger.info("start_handler called: user_id=%s", user_id)
    token = get_user_token(user_id)

    if not token:
        message = (
            "🤖 Welcome to OpenJiuwen Bot!\n\n"
            "⚠️ You are not logged in. Please use /login to authenticate first.\n\n"
            + _format_sections(AUTH_SECTIONS)
            + "\n\nOnce logged in, you can use:\n\n"
            + _format_sections(AGENT_SECTIONS + WORKFLOW_SECTIONS + GENERAL_SECTIONS)
        )
    else:
        message = (
            "🤖 Welcome to OpenJiuwen Bot!\n\n"
            "✅ You are logged in!\n\n"
            + _format_sections(AUTH_SECTIONS + AGENT_SECTIONS + WORKFLOW_SECTIONS + GENERAL_SECTIONS)
        )

    await update.message.reply_text(message)
