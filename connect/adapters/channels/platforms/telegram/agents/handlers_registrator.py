from telegram.ext import CommandHandler, MessageHandler, filters, ConversationHandler

from .commands import AGENTS, AGENTS_SEARCH, AGENT_EXECUTE, AGENT_START_CHAT, AGENT_END_CHAT
from .handlers import (
    agents_list_handler, agent_execute_handler, agents_search_handler,
    agent_chat_start_handler, agent_chat_message_handler, agent_chat_end_handler,
    AGENT_CHAT,
)


def register_handlers(app):
    app.add_handler(CommandHandler(AGENTS, agents_list_handler))
    app.add_handler(CommandHandler(AGENTS_SEARCH, agents_search_handler))
    app.add_handler(CommandHandler(AGENT_EXECUTE, agent_execute_handler))

    agent_chat_conv_handler = ConversationHandler(
        entry_points=[CommandHandler(AGENT_START_CHAT, agent_chat_start_handler)],
        states={
            AGENT_CHAT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, agent_chat_message_handler),
            ],
        },
        fallbacks=[CommandHandler(AGENT_END_CHAT, agent_chat_end_handler)],
    )
    app.add_handler(agent_chat_conv_handler)
