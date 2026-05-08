from .commands import LOGIN, LOGOUT, STATUS, CANCEL
from .handlers import login_start_handler, logout_handler, status_handler, cancel_handler


def register_handlers(bot) -> None:
    bot.tree.command(name=LOGIN, description="Log in to the OpenJiuwen backend")(login_start_handler)
    bot.tree.command(name=LOGOUT, description="Log out from the OpenJiuwen backend")(logout_handler)
    bot.tree.command(name=STATUS, description="Check your login status")(status_handler)
    bot.tree.command(name=CANCEL, description="Cancel the current operation")(cancel_handler)
