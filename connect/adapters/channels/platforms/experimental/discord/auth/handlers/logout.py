"""Logout slash command handler."""
import discord

from connect.client.auth.token_storage import get_user_token, remove_user_token
from ...state import get_user_data


async def logout_handler(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    if not get_user_token(user_id):
        await interaction.followup.send("ℹ️ You are not logged in.")
        return
    remove_user_token(user_id)
    user_data = get_user_data(user_id)
    user_data.pop('backend_client', None)
    user_data['state'] = 'idle'
    await interaction.followup.send("✅ Successfully logged out. Use `/login` to sign in again.")
