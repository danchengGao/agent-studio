"""Help command handler."""

HELP_TEXT = """OpenJiuwen Email Bot — Available Commands

Authentication
  login                          Log in to the backend
  logout                         Log out
  status                         Check login status
  cancel                         Cancel any active operation
  health                         Check backend connectivity

Workflows
  workflows                      List all workflows
  workflows search <query>       Search by keyword
  workflow execute <id>          Run a workflow (prompts for params via email replies)
  workflow skip                  Skip an optional parameter
  workflow cancel                Cancel parameter collection

Agents
  agents                         List all agents
  agents search <query>          Search by keyword
  agent execute <id> <message>   Send a single message to an agent
  agent start <id>               Start an interactive chat session
  agent end                      End the current chat session

  help                           Show this message

Usage: send an email to the bot with the command on the first line of the body.
"""


async def handle_help(user_id: str, say, user_data: dict) -> None:
    await say(HELP_TEXT)
