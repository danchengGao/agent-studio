"""
Thin Telegram wrapper around client.auth.do_login.
Handles I/O (sending messages) while client handles business logic.
"""
from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from connect.client.auth.do_login import do_login
from connect.client.auth.token_storage import set_user_data


async def _do_login(update: Update, context: ContextTypes.DEFAULT_TYPE, username: str, password: str):
    """Shared login logic — calls client and sends Telegram replies."""
    user_id = update.effective_user.id
    logger.info("_do_login called: user_id=%s, username=%s", user_id, username)
    backend_client = context.bot_data.get('backend_client')
    chat_id = update.effective_chat.id

    await context.bot.send_message(chat_id=chat_id, text=f"🔐 Logging in as {username}...")

    try:
        result = do_login(backend_client, username, password)
        set_user_data(user_id, result['token'], result['space_id'], result['refresh_token'])
        context.user_data.pop('login_username', None)

        await context.bot.send_message(
            chat_id=chat_id,
            text=f"✅ Successfully logged in as {username}!\n\n"
                 f"You can now use all bot commands.\n"
                 f"Use /logout to sign out."
        )
    except Exception as e:
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"❌ Login failed: {str(e)}\n\nPlease use /login to try again."
        )

    return ConversationHandler.END
