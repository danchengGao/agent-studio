"""List workflows slash command handler."""
import discord

from connect.client.workflows import list_workflows
from ...client_session import get_backend_client


async def workflows_list_handler(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    client, err = get_backend_client(user_id)
    if err:
        await interaction.followup.send(err)
        return
    try:
        result = list_workflows(client)
        workflows = result.get('data', {}).get('workflow_list', [])
        total = result.get('data', {}).get('total', len(workflows))
        if not workflows:
            await interaction.followup.send("ℹ️ No workflows found.")
            return
        lines = [f"✅ Found {total} workflow(s):\n"]
        for i, wf in enumerate(workflows[:10], 1):
            name = wf.get('name', 'Unnamed')
            wf_id = wf.get('workflow_id', 'N/A')
            desc = wf.get('desc', '')
            lines.append(f"{i}. **{name}**  |  ID: `{wf_id}`")
            if desc:
                lines.append(f"   *{desc[:80]}{'...' if len(desc) > 80 else ''}*")
        if total > 10:
            lines.append(f"*...and {total - 10} more*")
        lines.append("\n💡 Run a workflow: `/workflow_run workflow_id:<id>`")
        await interaction.followup.send('\n'.join(lines))
    except Exception as e:
        await interaction.followup.send(f"❌ Error: {e}")
