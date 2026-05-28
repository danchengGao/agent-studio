from .commands import AGENTS, AGENTS_SEARCH, AGENT_EXECUTE, AGENT_START_CHAT, AGENT_END_CHAT

SECTIONS = [
    ("🤖 Agent Commands", [
        ("/" + AGENTS, "List all available agents"),
        ("/" + AGENTS_SEARCH + " <keyword>", "Search agents by keyword"),
        ("/" + AGENT_EXECUTE + " <id> <msg>", "Send a single message to an agent"),
        ("/" + AGENT_START_CHAT + " <id>", "Start an interactive chat session with an agent"),
        ("/" + AGENT_END_CHAT, "End the current agent chat session"),
    ]),
]
