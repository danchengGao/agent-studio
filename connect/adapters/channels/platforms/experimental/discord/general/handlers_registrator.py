from .commands import START, HEALTH, HELP
from .handlers import start_handler, health_handler, help_handler


def register_handlers(bot) -> None:
    bot.tree.command(name=START, description="Welcome message")(start_handler)
    bot.tree.command(name=HEALTH, description="Check backend health")(health_handler)
    bot.tree.command(name=HELP, description="Show all available commands")(help_handler)
