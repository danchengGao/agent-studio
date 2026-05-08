from .commands import WORKFLOWS, WORKFLOW, SEARCH, EXECUTE, SKIP, CANCEL, DEMO1, DEMO2
from .handlers import handle_list, handle_search, handle_run, handle_skip, handle_cancel, handle_demo1, handle_demo2
from ....command_context import CommandContext


async def handle_command(ctx: CommandContext) -> bool:
    """Try to handle a workflow command. Returns True if handled."""
    if ctx.cmd1 == WORKFLOWS and ctx.cmd2 == SEARCH:
        query = ' '.join(ctx.parts[2:])
        await handle_search(ctx.user_id, ctx.say, ctx.user_data, query=query)
    elif ctx.cmd1 == WORKFLOWS:
        await handle_list(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == WORKFLOW and ctx.cmd2 == EXECUTE:
        arg1 = ctx.parts[2] if len(ctx.parts) > 2 else ''
        await handle_run(ctx.user_id, ctx.say, ctx.user_data, workflow_id=arg1)
    elif ctx.cmd1 == WORKFLOW and ctx.cmd2 == SKIP:
        await handle_skip(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == WORKFLOW and ctx.cmd2 == CANCEL:
        await handle_cancel(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == DEMO1:
        await handle_demo1(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == DEMO2:
        await handle_demo2(ctx.user_id, ctx.say, ctx.user_data)
    else:
        return False
    return True
