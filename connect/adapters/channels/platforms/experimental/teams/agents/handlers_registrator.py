from .commands import AGENTS, AGENT, SEARCH, EXECUTE, START, END
from .handlers import handle_list, handle_search, handle_run, handle_chat_start, handle_chat_end
from ....command_context import CommandContext


async def handle_command(ctx: CommandContext) -> bool:
    """Try to handle an agent command. Returns True if handled."""
    if ctx.cmd1 == AGENTS and ctx.cmd2 == SEARCH:
        query = ' '.join(ctx.parts[2:])
        await handle_search(ctx.user_id, ctx.say, ctx.user_data, query=query)
    elif ctx.cmd1 == AGENTS:
        await handle_list(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == AGENT and ctx.cmd2 == EXECUTE:
        arg1 = ctx.parts[2] if len(ctx.parts) > 2 else ''
        rest = ctx.parts[3] if len(ctx.parts) > 3 else ''
        await handle_run(ctx.user_id, ctx.say, ctx.user_data, agent_id=arg1, message=rest)
    elif ctx.cmd1 == AGENT and ctx.cmd2 == START:
        arg1 = ctx.parts[2] if len(ctx.parts) > 2 else ''
        await handle_chat_start(ctx.user_id, ctx.say, ctx.user_data, agent_id=arg1)
    elif ctx.cmd1 == AGENT and ctx.cmd2 == END:
        await handle_chat_end(ctx.user_id, ctx.say, ctx.user_data)
    else:
        return False
    return True
