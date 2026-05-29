"""Help command handler."""

HELP_TEXT = """*OpenJiuwen Bot — Available Commands*

*Authentication*
• *login* — Log in to the backend
• *logout* — Log out
• *status* — Check login status
• *health* — Check backend connectivity

*Workflows*
• *workflows* — List all workflows
• *workflows search <query>* — Search by keyword
• *workflow run <id>* — Run a workflow (prompts for params)
• *workflow cancel* — Cancel parameter collection

*Agents*
• *agents* — List all agents
• *agents search <query>* — Search by keyword
• *agent run <id> <message>* — Single message to an agent
• *agent chat <id>* — Start interactive chat session
• *end chat* — End the current chat session

• *help* — Show this message"""


async def handle_help(user_id: str, say, user_data: dict) -> None:
    await say(HELP_TEXT)
