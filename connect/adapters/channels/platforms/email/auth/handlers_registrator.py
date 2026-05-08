from .commands import LOGIN, LOGOUT, STATUS, CANCEL
from .handlers import handle_login, handle_logout, handle_status, handle_cancel
from ...command_context import CommandContext


async def handle_command(ctx: CommandContext) -> bool:
    """Try to handle an auth command. Returns True if handled."""
    if ctx.cmd1 == LOGIN:
        await handle_login(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == LOGOUT:
        await handle_logout(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == STATUS:
        await handle_status(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == CANCEL:
        await handle_cancel(ctx.user_id, ctx.say, ctx.user_data)
    else:
        return False
    return True
