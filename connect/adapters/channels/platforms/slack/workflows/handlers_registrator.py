from .commands import WORKFLOWS, WORKFLOWS_SEARCH, WORKFLOW_EXECUTE, WORKFLOW_SKIP, WORKFLOW_CANCEL, DEMO1, DEMO2
from .handlers import handle_list, handle_search, handle_run, handle_skip, handle_cancel, demo1_handler, demo2_handler


def register_handlers(app) -> None:
    app.command('/' + WORKFLOWS)(handle_list)
    app.command('/' + WORKFLOWS_SEARCH)(handle_search)
    app.command('/' + WORKFLOW_EXECUTE)(handle_run)
    app.command('/' + WORKFLOW_SKIP)(handle_skip)
    app.command('/' + WORKFLOW_CANCEL)(handle_cancel)
    app.command('/' + DEMO1)(demo1_handler)
    app.command('/' + DEMO2)(demo2_handler)
