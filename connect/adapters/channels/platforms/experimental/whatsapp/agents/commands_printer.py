from .commands import AGENTS, AGENT, SEARCH, EXECUTE, START, END

SECTIONS = [
    ("🤖 Agent Commands", [
        (AGENTS, "List all agents"),
        (f"{AGENTS} {SEARCH} <keyword>", "Search agents"),
        (f"{AGENT} {EXECUTE} <id> <message>", "Send a single message to an agent"),
        (f"{AGENT} {START} <id>", "Start an interactive chat session with an agent"),
        (f"{AGENT} {END}", "End the current agent chat session"),
    ]),
]
