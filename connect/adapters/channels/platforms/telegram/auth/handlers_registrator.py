from telegram.ext import CommandHandler, MessageHandler, filters, ConversationHandler

from .commands import LOGIN, CANCEL, LOGOUT, STATUS
from .handlers import (
    login_start_handler, login_username_handler, login_password_handler,
    login_cancel_handler, logout_handler, status_handler,
    LOGIN_USERNAME, LOGIN_PASSWORD,
)


def register_handlers(app):
    login_conv_handler = ConversationHandler(
        entry_points=[CommandHandler(LOGIN, login_start_handler)],
        states={
            LOGIN_USERNAME: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, login_username_handler),
            ],
            LOGIN_PASSWORD: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, login_password_handler),
            ],
        },
        fallbacks=[CommandHandler(CANCEL, login_cancel_handler)],
    )
    app.add_handler(login_conv_handler)
    app.add_handler(CommandHandler(LOGOUT, logout_handler))
    app.add_handler(CommandHandler(STATUS, status_handler))
