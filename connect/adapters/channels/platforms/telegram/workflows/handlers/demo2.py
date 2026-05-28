from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes


async def demo2_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Demo listener 2 - /demo2"""
    logger.info("demo2_handler called: user_id=%s", update.effective_user.id)
    message = "🚀 Demo 2 Will be triggered here"
    await update.message.reply_text(message)
