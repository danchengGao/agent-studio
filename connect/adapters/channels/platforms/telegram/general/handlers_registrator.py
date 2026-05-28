from telegram.ext import CommandHandler

from .commands import START, HELP, HEALTH
from .handlers import start_handler, help_handler, health_handler


def register_handlers(app):
    app.add_handler(CommandHandler(START, start_handler))
    app.add_handler(CommandHandler(HELP, help_handler))
    app.add_handler(CommandHandler(HEALTH, health_handler))
