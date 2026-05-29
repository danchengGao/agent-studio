from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from ._do_login import _do_login


async def login_password_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive password and perform login."""
    logger.info("login_password_handler called: user_id=%s", update.effective_user.id)
    password = update.message.text.strip()

    # Delete the password message for security
    try:
        await update.message.delete()
    except Exception as e:
        logger.warning("Could not delete password message (chat_id=%s): %s", update.effective_chat.id, e)

    username = context.user_data.get('login_username')
    if not username:
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="❌ Session expired. Please use /login to try again."
        )
        return ConversationHandler.END

    return await _do_login(update, context, username, password)
