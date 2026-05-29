"""Help text for GitHub slash commands."""

from openjiuwen.core.common.logging import logger

COMMANDS = """
**OpenJiuwen GitHub Commands**

Comment one of the following on any issue or PR:

| Command | Description |
|---|---|
| `/login` | Log in to OpenJiuwen |
| `/logout` | Log out |
| `/status` | Show login status |
| `/cancel` | Cancel active operation |
| `/health` | Check backend status |
| `/help` | Show this message |
| `/workflows` | List workflows |
| `/workflows search <query>` | Search workflows |
| `/workflow run <id>` | Run a workflow |
| `/agents` | List agents |
| `/agents search <query>` | Search agents |
| `/agent run <id> <message>` | Run agent with a message |
| `/agent chat <id>` | Start a multi-turn agent chat |
| `/skip` | Skip an optional workflow parameter |
"""


def print_bot_commands() -> None:
    logger.info(COMMANDS)
