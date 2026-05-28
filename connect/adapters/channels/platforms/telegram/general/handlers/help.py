from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from .start import start_handler


async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show help - /help"""
    logger.info("help_handler called: user_id=%s", update.effective_user.id)
    await start_handler(update, context)
