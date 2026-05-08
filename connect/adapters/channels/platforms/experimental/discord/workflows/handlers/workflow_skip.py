import discord

from ...state import get_user_data


async def workflow_skip_handler(interaction: discord.Interaction) -> None:
    """Skip the current optional workflow parameter collection step."""
    user_id = str(interaction.user.id)
    user_data = get_user_data(user_id)
    if user_data.get('state') != 'wf_collecting':
        await interaction.response.send_message(
            "ℹ️ No active workflow parameter collection to skip.", ephemeral=True
        )
        return
    await interaction.response.defer(ephemeral=True)
    from .workflow_execute_collect import on_collect_param
    await on_collect_param(user_id, '/workflow_skip', interaction.followup.send, user_data)
