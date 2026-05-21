from .commands import AGENTS, AGENT, SEARCH, EXECUTE, START
from .handlers import handle_list, handle_search, handle_run, handle_chat_start
from ....command_context import CommandContext


async def handle_command(ctx: CommandContext) -> bool:
    if ctx.cmd1 == AGENTS and ctx.cmd2 == SEARCH:
        await handle_search(ctx.user_id, ctx.say, ctx.user_data, query=" ".join(ctx.parts[2:]))
    elif ctx.cmd1 == AGENTS:
        await handle_list(ctx.user_id, ctx.say, ctx.user_data)
    elif ctx.cmd1 == AGENT and ctx.cmd2 == EXECUTE:
        await handle_run(ctx.user_id, ctx.say, ctx.user_data,
                         agent_id=ctx.parts[2] if len(ctx.parts) > 2 else "",
                         message=ctx.parts[3] if len(ctx.parts) > 3 else "")
    elif ctx.cmd1 == AGENT and ctx.cmd2 == START:
        await handle_chat_start(ctx.user_id, ctx.say, ctx.user_data, agent_id=ctx.parts[2] if len(ctx.parts) > 2
        else "")
    else:
        return False
    return True
