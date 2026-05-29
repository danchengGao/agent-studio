async def handle(user_id: str, say, user_data: dict) -> None:
    await say(
        "Available commands: "
        "help, start, health, "
        "login, logout, status, "
        "workflows, workflow run followed by name, "
        "agents, agent run followed by name. "
        "What would you like to do?"
    )
