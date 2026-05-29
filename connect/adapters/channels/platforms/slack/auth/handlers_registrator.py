from .commands import LOGIN, LOGOUT, STATUS, CANCEL
from .handlers import handle_login, handle_logout, handle_status, handle_cancel


def register_handlers(app) -> None:
    app.command('/' + LOGIN)(handle_login)
    app.command('/' + LOGOUT)(handle_logout)
    app.command('/' + STATUS)(handle_status)
    app.command('/' + CANCEL)(handle_cancel)
