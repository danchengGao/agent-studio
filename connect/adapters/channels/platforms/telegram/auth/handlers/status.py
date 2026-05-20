from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from connect.client.auth.token_storage import get_user_token, remove_user_token
from connect.client.auth.verify_token import verify_token as api_verify_token


async def status_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check login status - /status"""
    user_id = update.effective_user.id
    logger.info("status_handler called: user_id=%s", user_id)
    token = get_user_token(user_id)
    backend_client = context.bot_data.get('backend_client')

    if not token:
        await update.message.reply_text(
            "❌ Not logged in\n\nUse /login to authenticate."
        )
        return

    backend_client.set_token(token)

    try:
        api_verify_token(backend_client)
        await update.message.reply_text(
            "✅ Logged in\n\nToken is valid.\nUse /logout to sign out."
        )
    except Exception:
        await update.message.reply_text(
            "❌ Token expired\n\nPlease use /login to authenticate again."
        )
        remove_user_token(user_id)
