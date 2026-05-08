from .commands import WORKFLOWS, WORKFLOW, SEARCH, EXECUTE, SKIP, CANCEL, DEMO1, DEMO2

SECTIONS = [
    ("📋 Workflow Commands", [
        (WORKFLOWS, "List all workflows"),
        (f"{WORKFLOWS} {SEARCH} <keyword>", "Search workflows"),
        (f"{WORKFLOW} {EXECUTE} <id>", "Execute a workflow"),
        (f"{WORKFLOW} {SKIP}", "Skip optional workflow parameter"),
        (f"{WORKFLOW} {CANCEL}", "Cancel workflow parameter collection"),
    ]),
    ("🧪 Demo Commands", [
        (DEMO1, "Demo 1 Runner"),
        (DEMO2, "Demo 2 Runner"),
    ]),
]
