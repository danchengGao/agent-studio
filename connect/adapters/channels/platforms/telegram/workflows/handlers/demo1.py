from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes


async def demo1_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Demo listener 1 - /demo1"""
    logger.info("demo1_handler called: user_id=%s", update.effective_user.id)
    message = "✅ Demo 1 Will be triggered here"
    await update.message.reply_text(message)
