async def handle(user_id: str, say, user_data: dict) -> None:
    await say(
        "Welcome to OpenJiuwen! "
        "I can help you run AI workflows and chat with agents. "
        "To get started, say login to authenticate, "
        "then say workflows to see available workflows, "
        "or say agents to see available agents. "
        "Say help to hear all commands."
    )
