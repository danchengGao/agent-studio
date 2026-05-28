from .commands import START, HEALTH, HELP
from .handlers import handle_start, handle_health, handle_help


def register_handlers(app) -> None:
    app.command('/' + START)(handle_start)
    app.command('/' + HEALTH)(handle_health)
    app.command('/' + HELP)(handle_help)
