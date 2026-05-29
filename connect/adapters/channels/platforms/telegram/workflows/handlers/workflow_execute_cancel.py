from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler


async def workflow_exec_cancel_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel workflow execution."""
    logger.info("workflow_exec_cancel_handler called: user_id=%s", update.effective_user.id)
    context.user_data.pop('wf_exec_session', None)
    await update.message.reply_text("❌ Workflow execution cancelled.")
    return ConversationHandler.END
