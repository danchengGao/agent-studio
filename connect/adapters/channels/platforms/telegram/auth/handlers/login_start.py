from openjiuwen.core.common.logging import logger

from telegram import Update, ReplyKeyboardRemove
from telegram.ext import ContextTypes, ConversationHandler

from connect.client.auth.token_storage import get_user_token, get_user_space_id, remove_user_token
from connect.client.auth.verify_token import verify_token as api_verify_token

LOGIN_USERNAME = 0


async def login_start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start login process - /login"""
    user_id = update.effective_user.id
    logger.info("login_start_handler called: user_id=%s", user_id)
    backend_client = context.bot_data.get('backend_client')

    token = get_user_token(user_id)
    if token:
        backend_client.set_token(token)
        backend_client.set_space_id(get_user_space_id(user_id))
        try:
            api_verify_token(backend_client)
            await update.message.reply_text(
                "✅ You are already logged in!\n\nUse /logout to sign out."
            )
            return ConversationHandler.END
        except Exception:
            remove_user_token(user_id)

    await update.message.reply_text(
        "🔐 Login to OpenJiuwen Backend\n\nPlease enter your username (email):",
        reply_markup=ReplyKeyboardRemove()
    )
    return LOGIN_USERNAME
