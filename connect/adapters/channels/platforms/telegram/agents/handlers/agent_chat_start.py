from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from .agent_chat import AGENT_CHAT
from ...auth import require_login


@require_login
async def agent_chat_start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start a chat session with an agent - /agent_start_chat <agent_id>"""
    logger.info("agent_chat_start_handler called: user_id=%s, args=%s", update.effective_user.id, context.args)
    try:
        if not context.args:
            await update.message.reply_text(
                "❌ Usage: /agent_start_chat <agent_id>\n"
                "Example: /agent_start_chat 12345"
            )
            return ConversationHandler.END

        agent_id = context.args[0]
        context.user_data['agent_chat'] = {'agent_id': agent_id, 'conversation_id': ''}

        await update.message.reply_text(
            f"🤖 Starting chat with agent {agent_id}\n\n"
            f"Send me messages and I'll forward them to the agent.\n"
            f"Type /agent_end_chat to finish the conversation."
        )
        return AGENT_CHAT
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")
        return ConversationHandler.END
