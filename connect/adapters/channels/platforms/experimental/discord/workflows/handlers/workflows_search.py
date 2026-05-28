"""Search workflows slash command handler."""
import discord
from discord import app_commands

from connect.client.workflows import search_workflows
from ...client_session import get_backend_client


@app_commands.describe(keyword="Search keyword")
async def workflows_search_handler(interaction: discord.Interaction, keyword: str) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    client, err = get_backend_client(user_id)
    if err:
        await interaction.followup.send(err)
        return
    try:
        result = search_workflows(client, keyword)
        data = result.get('data', {})
        workflows = data.get('workflow_list', data.get('workflows', []))
        if not workflows:
            await interaction.followup.send(f"ℹ️ No workflows found matching `{keyword}`.")
            return
        lines = [f"🔍 Found {len(workflows)} workflow(s) matching `{keyword}`:\n"]
        for i, wf in enumerate(workflows[:10], 1):
            name = wf.get('name', 'Unnamed')
            wf_id = wf.get('workflow_id', 'N/A')
            lines.append(f"{i}. **{name}**  |  ID: `{wf_id}`")
        await interaction.followup.send('\n'.join(lines))
    except Exception as e:
        await interaction.followup.send(f"❌ Error: {e}")
