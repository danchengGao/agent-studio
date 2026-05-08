from .commands import CMD_WORKFLOWS, CMD_WORKFLOW
from .handlers import workflows_list, workflows_search, workflow_execute
from ...command_context import CommandContext


async def handle_command(ctx: CommandContext) -> bool:
    if ctx.cmd1 == CMD_WORKFLOWS:
        if ctx.cmd2 == 'search':
            query = ' '.join(ctx.parts[2:]) if len(ctx.parts) > 2 else ''
            await workflows_search.handle(ctx.user_id, query, ctx.say, ctx.user_data)
        else:
            await workflows_list.handle(ctx.user_id, ctx.say, ctx.user_data)
        return True
    if ctx.cmd1 == CMD_WORKFLOW and ctx.cmd2 == 'run':
        name = ' '.join(ctx.parts[2:]) if len(ctx.parts) > 2 else ''
        await workflow_execute.handle(ctx.user_id, name, ctx.say, ctx.user_data)
        return True
    return False
