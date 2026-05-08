from .commands import AGENTS, AGENTS_SEARCH, AGENT_EXECUTE, AGENT_START_CHAT, AGENT_END_CHAT
from .handlers import (
    agents_list_handler, agents_search_handler, agent_execute_handler,
    agent_chat_start_handler, agent_chat_end_handler,
)


def register_handlers(bot) -> None:
    bot.tree.command(name=AGENTS, description="List all available agents")(agents_list_handler)
    bot.tree.command(name=AGENTS_SEARCH, description="Search agents by keyword")(agents_search_handler)
    bot.tree.command(name=AGENT_EXECUTE, description="Send a single message to an agent")(agent_execute_handler)
    bot.tree.command(name=AGENT_START_CHAT,
                     description="Start an interactive chat session with an agent")(agent_chat_start_handler)
    bot.tree.command(name=AGENT_END_CHAT, description="End the current agent chat session")(agent_chat_end_handler)
