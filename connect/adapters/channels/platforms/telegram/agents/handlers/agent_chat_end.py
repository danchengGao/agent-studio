from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler


async def agent_chat_end_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """End agent chat session - /agent_end_chat"""
    logger.info("agent_chat_end_handler called: user_id=%s", update.effective_user.id)
    context.user_data.pop('agent_chat', None)
    await update.message.reply_text(
        "👋 Chat session ended. Use /agent_start_chat <agent_id> to start a new one."
    )
    return ConversationHandler.END
