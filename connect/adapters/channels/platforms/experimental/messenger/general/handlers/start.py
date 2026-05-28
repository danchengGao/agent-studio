"""Handle the 'start' command."""


async def handle(user_id: str, say, user_data: dict) -> None:
    await say(
        "Welcome to OpenJiuwen on Messenger!\n\n"
        "I can help you run AI workflows and chat with agents.\n\n"
        "To get started:\n"
        "  1. Send 'login' to authenticate\n"
        "  2. Send 'workflows' to see available workflows\n"
        "  3. Send 'agents' to see available agents\n\n"
        "Send 'help' to see all commands."
    )
