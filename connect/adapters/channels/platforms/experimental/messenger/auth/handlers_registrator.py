"""Register auth command handlers for the Messenger platform."""
from .commands import CMD_LOGIN, CMD_LOGOUT, CMD_STATUS, CMD_CANCEL
from .handlers import login_start, logout, status, cancel
from ....command_context import CommandContext


async def handle_command(ctx: CommandContext) -> bool:
    if ctx.cmd1 == CMD_LOGIN:
        await login_start.handle(ctx.user_id, ctx.say, ctx.user_data)
        return True
    if ctx.cmd1 == CMD_LOGOUT:
        await logout.handle(ctx.user_id, ctx.say, ctx.user_data)
        return True
    if ctx.cmd1 == CMD_STATUS:
        await status.handle(ctx.user_id, ctx.say, ctx.user_data)
        return True
    if ctx.cmd1 == CMD_CANCEL:
        await cancel.handle(ctx.user_id, ctx.say, ctx.user_data)
        return True
    return False
