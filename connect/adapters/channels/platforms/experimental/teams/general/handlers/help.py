"""Help command handler."""

HELP_TEXT = """**OpenJiuwen Bot — Available Commands**

**Authentication**
`login` — Log in to the backend
`logout` — Log out
`status` — Check login status
`health` — Check backend connectivity

**Workflows**
`workflows` — List all workflows
`workflows search <query>` — Search workflows by keyword
`workflow run <id>` — Run a workflow (prompts for parameters)
`workflow cancel` — Cancel current workflow parameter collection

**Agents**
`agents` — List all agents
`agents search <query>` — Search agents by keyword
`agent run <id> <message>` — Send a single message to an agent
`agent chat <id>` — Start an interactive chat session
`end chat` — End the current chat session

`help` — Show this message
"""


async def handle_help(user_id: str, say, user_data: dict) -> None:
    await say(HELP_TEXT)
