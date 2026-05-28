from .commands import WORKFLOWS, WORKFLOWS_SEARCH, WORKFLOW_EXECUTE, WORKFLOW_SKIP, WORKFLOW_CANCEL, DEMO1, DEMO2
from .handlers import (
    workflows_list_handler, workflows_search_handler,
    workflow_execute_handler, workflow_skip_handler, workflow_exec_cancel_handler,
    demo1_handler, demo2_handler,
)


def register_handlers(bot) -> None:
    bot.tree.command(name=WORKFLOWS, description="List all available workflows")(workflows_list_handler)
    bot.tree.command(name=WORKFLOWS_SEARCH, description="Search workflows by keyword")(workflows_search_handler)
    bot.tree.command(name=WORKFLOW_EXECUTE, description="Execute a workflow")(workflow_execute_handler)
    bot.tree.command(name=WORKFLOW_SKIP, description="Skip optional workflow parameter")(workflow_skip_handler)
    bot.tree.command(name=WORKFLOW_CANCEL,
                     description="Cancel workflow parameter collection")(workflow_exec_cancel_handler)
    bot.tree.command(name=DEMO1, description="Demo 1 Runner")(demo1_handler)
    bot.tree.command(name=DEMO2, description="Demo 2 Runner")(demo2_handler)
