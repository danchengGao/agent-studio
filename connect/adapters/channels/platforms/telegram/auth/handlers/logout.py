from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from connect.client.auth.token_storage import get_user_token, remove_user_token


async def logout_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Logout user - /logout"""
    user_id = update.effective_user.id
    logger.info("logout_handler called: user_id=%s", user_id)
    backend_client = context.bot_data.get('backend_client')

    token = get_user_token(user_id)
    if not token:
        await update.message.reply_text("ℹ️ You are not logged in.")
        return

    remove_user_token(user_id)
    if backend_client:
        backend_client.set_token(None)
        backend_client.set_space_id(None)

    await update.message.reply_text(
        "✅ Successfully logged out.\n\nUse /login to sign in again."
    )
