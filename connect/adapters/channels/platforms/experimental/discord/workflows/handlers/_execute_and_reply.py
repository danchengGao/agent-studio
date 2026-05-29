"""Shared execution helpers — run a workflow and format the result."""
import discord

from connect.client.workflows.execute_workflow import execute_workflow
from connect.client.workflows import parse_workflow_result


async def _execute_and_followup(interaction: discord.Interaction, client, workflow_id: str, inputs: dict) -> None:
    await interaction.followup.send(
        f"🚀 Executing with inputs: `{inputs}`" if inputs else "🚀 Executing workflow..."
    )
    await _run_and_format(interaction.followup.send, client, workflow_id, inputs)


async def _execute_and_say(say, client, workflow_id: str, inputs: dict) -> None:
    await say(f"🚀 Executing with inputs: `{inputs}`" if inputs else "🚀 Executing workflow...")
    await _run_and_format(say, client, workflow_id, inputs)


async def _run_and_format(send, client, workflow_id: str, inputs: dict) -> None:
    events = execute_workflow(client, workflow_id, inputs)
    outputs, error = parse_workflow_result(events)
    if error:
        await send(f"❌ Execution failed: {error}")
        return
    lines = ["✅ **Workflow executed successfully!**\n"]
    if outputs:
        for key, val in outputs.items():
            lines.append(f"**{key}:**\n{str(val)[:500]}")
    else:
        lines.append(f"*Received {len(events)} trace event(s) — no output found.*")
    await send('\n'.join(lines))
