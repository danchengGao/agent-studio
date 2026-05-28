from .commands import CMD_HELP, CMD_START, CMD_HEALTH
from .handlers import help as help_handler, start, health
from ....command_context import CommandContext


async def handle_command(ctx: CommandContext) -> bool:
    if ctx.cmd1 == CMD_HELP:
        await help_handler.handle(ctx.user_id, ctx.say, ctx.user_data)
        return True
    if ctx.cmd1 == CMD_START:
        await start.handle(ctx.user_id, ctx.say, ctx.user_data)
        return True
    if ctx.cmd1 == CMD_HEALTH:
        await health.handle(ctx.user_id, ctx.say, ctx.user_data)
        return True
    return False
