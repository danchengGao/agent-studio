"""Status slash command handler — shows current login state."""
import discord

from connect.client.auth.token_storage import get_user_token, remove_user_token
from connect.client.auth.verify_token import verify_token as api_verify_token
from connect.client import OpenJiuwenClient
from ...state import get_app_config


async def status_handler(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    token = get_user_token(user_id)
    if not token:
        await interaction.followup.send("❌ Not logged in. Use `/login` to authenticate.")
        return
    backend_url = get_app_config().get('backend_url', 'http://localhost:8000')
    client = OpenJiuwenClient(base_url=backend_url)
    client.set_token(token)
    try:
        api_verify_token(client)
        await interaction.followup.send("✅ **Logged in** — token is valid.\nUse `/logout` to sign out.")
    except Exception:
        remove_user_token(user_id)
        await interaction.followup.send("❌ Token expired. Please `/login` again.")
