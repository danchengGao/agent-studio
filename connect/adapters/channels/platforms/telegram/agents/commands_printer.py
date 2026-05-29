from .commands import AGENTS, AGENTS_SEARCH, AGENT_EXECUTE, AGENT_START_CHAT, AGENT_END_CHAT

SECTIONS = [
    ("🤖 Agent Commands", [
        ("/" + AGENTS, "List all agents"),
        ("/" + AGENTS_SEARCH + " <keyword>", "Search agents"),
        ("/" + AGENT_EXECUTE + " <id> <msg>", "Send message to agent"),
        ("/" + AGENT_START_CHAT + " <id>", "Start chat session with agent"),
        ("/" + AGENT_END_CHAT, "End chat session"),
    ]),
]
