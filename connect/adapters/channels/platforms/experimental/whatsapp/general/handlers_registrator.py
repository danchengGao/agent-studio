from .commands import START, HEALTH, HELP
from .handlers import handle_start, handle_health, handle_help
from ....command_context import CommandContext


async def handle_command(ctx: CommandContext) -> bool:
    """Try to handle a general command. Returns True if handled."""
    if ctx.cmd1 == START:
        await handle_start(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == HEALTH:
        await handle_health(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == HELP:
        await handle_help(ctx.user_id, ctx.say, ctx.user_data)
    else:
        return False
    return True
