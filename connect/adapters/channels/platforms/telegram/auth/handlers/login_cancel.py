from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler


async def login_cancel_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel login process - /cancel"""
    logger.info("login_cancel_handler called: user_id=%s", update.effective_user.id)
    context.user_data.pop('login_username', None)
    await update.message.reply_text("Login cancelled.")
    return ConversationHandler.END
