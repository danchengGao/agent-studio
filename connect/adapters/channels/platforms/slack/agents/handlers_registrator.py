from .commands import AGENTS, AGENTS_SEARCH, AGENT_EXECUTE, AGENT_START_CHAT, AGENT_END_CHAT
from .handlers import handle_list, handle_search, handle_run, handle_chat_start, handle_chat_end


def register_handlers(app) -> None:
    app.command('/' + AGENTS)(handle_list)
    app.command('/' + AGENTS_SEARCH)(handle_search)
    app.command('/' + AGENT_EXECUTE)(handle_run)
    app.command('/' + AGENT_START_CHAT)(handle_chat_start)
    app.command('/' + AGENT_END_CHAT)(handle_chat_end)
