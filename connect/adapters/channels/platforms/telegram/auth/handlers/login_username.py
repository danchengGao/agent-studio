from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from ._do_login import _do_login

LOGIN_PASSWORD = 1


async def login_username_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive username, then either ask for password or login immediately."""
    username = update.message.text.strip()
    logger.info("login_username_handler called: user_id=%s, username=%s", update.effective_user.id, username)
    context.user_data['login_username'] = username

    enable_password_login = context.bot_data.get('enable_password_login', False)

    if enable_password_login:
        await update.message.reply_text(
            f"Username: {username}\n\nPlease enter your password:"
        )
        return LOGIN_PASSWORD
    else:
        return await _do_login(update, context, username, password='')
