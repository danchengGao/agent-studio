"""Help slash command handler."""
import discord

HELP_TEXT = """**OpenJiuwen Discord Bot** — available commands:

**Auth**
`/login`                       — Log in to the OpenJiuwen backend
`/logout`                      — Log out
`/status`                      — Check login status

**Workflows**
`/workflows`                   — List all workflows
`/workflow_search keyword:`    — Search workflows
`/workflow_run workflow_id:`   — Run a workflow (sends DM for parameters if needed)
`/workflow_cancel`             — Cancel workflow parameter collection

**Agents**
`/agents`                      — List all agents
`/agent_search keyword:`       — Search agents
`/agent_run agent_id: message:` — Run agent with a single message
`/agent_chat agent_id:`        — Start interactive chat with an agent (via DM)
`/agent_end_chat`              — End current agent chat session

**General**
`/health`                      — Check backend health
`/help`                        — Show this message

> Multi-step flows (login, workflow parameters, agent chat) happen via DM."""


async def help_handler(interaction: discord.Interaction) -> None:
    await interaction.response.send_message(HELP_TEXT, ephemeral=True)
