"""End agent chat slash command handler."""
import discord

from ...state import get_user_data


async def agent_chat_end_handler(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    user_data = get_user_data(user_id)
    user_data.pop('agent_chat', None)
    user_data['state'] = 'idle'
    await interaction.followup.send("👋 Chat session ended. Use `/agent_chat` to start a new one.")
