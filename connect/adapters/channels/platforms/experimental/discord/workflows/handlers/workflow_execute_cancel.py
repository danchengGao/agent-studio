"""Cancel workflow parameter collection slash command handler."""
import discord

from ...state import get_user_data


async def workflow_exec_cancel_handler(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    user_data = get_user_data(user_id)
    user_data.pop('wf_exec_session', None)
    user_data['state'] = 'idle'
    await interaction.followup.send("❌ Workflow execution cancelled.")
