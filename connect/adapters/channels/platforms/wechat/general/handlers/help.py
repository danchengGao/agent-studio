async def handle(user_id: str, say, user_data: dict) -> None:
    lines = [
        "OpenJiuwen WeChat Bot - available commands:",
        "",
        "  help          Show this message",
        "  start         Introduction",
        "  health        Backend health check",
        "",
        "  login         Log in to OpenJiuwen",
        "  logout        Log out",
        "  status        Show login status",
        "",
        "  workflows     List workflows",
        "  workflow run <name>   Run a workflow",
        "",
        "  agents        List agents",
        "  agent run <name>      Start agent chat",
        "  agent end             End agent chat",
    ]
    await say("\n".join(lines))
