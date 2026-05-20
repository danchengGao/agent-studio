from .commands import CMD_AGENTS, CMD_AGENT
from .handlers import agents_list, agents_search, agent_execute, agent_chat_start, agent_chat_end
from ....command_context import CommandContext


async def handle_command(ctx: CommandContext) -> bool:
    if ctx.cmd1 == CMD_AGENTS:
        if ctx.cmd2 == 'search':
            query = ' '.join(ctx.parts[2:]) if len(ctx.parts) > 2 else ''
            await agents_search.handle(ctx.user_id, query, ctx.say, ctx.user_data)
        else:
            await agents_list.handle(ctx.user_id, ctx.say, ctx.user_data)
        return True
    if ctx.cmd1 == CMD_AGENT:
        if ctx.cmd2 == 'run':
            name = ' '.join(ctx.parts[2:]) if len(ctx.parts) > 2 else ''
            await agent_chat_start.handle(ctx.user_id, name, ctx.say, ctx.user_data)
            return True
        if ctx.cmd2 == 'end':
            await agent_chat_end.handle(ctx.user_id, ctx.say, ctx.user_data)
            return True
        if ctx.cmd2 == 'execute':
            name = ' '.join(ctx.parts[2:]) if len(ctx.parts) > 2 else ''
            await agent_execute.handle(ctx.user_id, name, ctx.say, ctx.user_data)
            return True
    return False
