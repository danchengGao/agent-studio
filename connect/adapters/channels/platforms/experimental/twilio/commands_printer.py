"""Print available SMS commands."""

from openjiuwen.core.common.logging import logger

COMMANDS = """
Available commands (send as SMS text):

  login                        Log in to OpenJiuwen
  logout                       Log out
  status                       Show login status
  cancel                       Cancel active operation
  health                       Check backend status

  workflows                    List workflows
  workflows search <query>     Search workflows
  workflow run <id>            Run a workflow

  agents                       List agents
  agents search <query>        Search agents
  agent run <id> <message>     Run agent with a message
  agent start <id>             Start an agent chat
  agent end                    End agent chat

  help                         Show this message
"""


def print_bot_commands() -> None:
    logger.info(COMMANDS)
