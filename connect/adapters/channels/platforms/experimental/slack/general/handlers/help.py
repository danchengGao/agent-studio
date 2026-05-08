HELP_TEXT = """*OpenJiuwen Slack Bot* — available commands:

*Auth*
  `/login`                       — Log in to the OpenJiuwen backend
  `/logout`                      — Log out
  `/auth_status`                 — Check login status

*Workflows*
  `/workflows`                   — List all workflows
  `/workflows_search <keyword>`  — Search workflows
  `/workflow_run <id>`           — Run a workflow (prompts for parameters)
  `/workflow_cancel`             — Cancel workflow parameter collection

*Agents*
  `/agents`                      — List all agents
  `/agents_search <keyword>`     — Search agents
  `/agent_run <id> <message>`    — Run agent with a single message
  `/agent_chat <id>`             — Start interactive chat with an agent
  `/agent_end_chat`              — End current agent chat session

*General*
  `/health`                      — Check backend health
  `/help`                        — Show this message"""


def handle_help(ack, respond, command):
    ack()
    respond(HELP_TEXT)
