from telegram.ext import CommandHandler, MessageHandler, filters, ConversationHandler

from .commands import WORKFLOWS, WORKFLOWS_SEARCH, WORKFLOW_EXECUTE, WORKFLOW_SKIP, WORKFLOW_CANCEL, DEMO1, DEMO2
from .handlers import (
    demo1_handler, demo2_handler,
    workflows_list_handler, workflow_execute_handler, workflows_search_handler,
    workflow_exec_collect_handler, workflow_exec_cancel_handler, WF_EXEC_COLLECTING,
)


def register_handlers(app):
    app.add_handler(CommandHandler(DEMO1, demo1_handler))
    app.add_handler(CommandHandler(DEMO2, demo2_handler))

    app.add_handler(CommandHandler(WORKFLOWS, workflows_list_handler))
    app.add_handler(CommandHandler(WORKFLOWS_SEARCH, workflows_search_handler))

    workflow_execute_conv_handler = ConversationHandler(
        entry_points=[CommandHandler(WORKFLOW_EXECUTE, workflow_execute_handler)],
        states={
            WF_EXEC_COLLECTING: [
                CommandHandler(WORKFLOW_SKIP, workflow_exec_collect_handler),
                MessageHandler(filters.TEXT & ~filters.COMMAND, workflow_exec_collect_handler),
            ],
        },
        fallbacks=[CommandHandler(WORKFLOW_CANCEL, workflow_exec_cancel_handler)],
    )
    app.add_handler(workflow_execute_conv_handler)
