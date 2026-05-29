from .commands import WORKFLOWS, WORKFLOWS_SEARCH, WORKFLOW_EXECUTE, WORKFLOW_SKIP, WORKFLOW_CANCEL, DEMO1, DEMO2

SECTIONS = [
    ("📋 Workflow Commands", [
        ("/" + WORKFLOWS, "List all available workflows"),
        ("/" + WORKFLOWS_SEARCH + " <keyword>", "Search workflows by keyword"),
        ("/" + WORKFLOW_EXECUTE + " <id>", "Execute a workflow"),
        ("/" + WORKFLOW_SKIP, "Skip optional workflow parameter"),
        ("/" + WORKFLOW_CANCEL, "Cancel workflow parameter collection"),
    ]),
    ("🧪 Demo Commands", [
        ("/" + DEMO1, "Demo 1 Runner"),
        ("/" + DEMO2, "Demo 2 Runner"),
    ]),
]
