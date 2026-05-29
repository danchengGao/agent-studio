"""Login slash command handler — initiates the multi-step login flow via DM."""
import discord

from connect.client.auth.token_storage import get_user_token, remove_user_token
from connect.client.auth.verify_token import verify_token as api_verify_token
from connect.client import OpenJiuwenClient
from ...state import get_user_data, get_app_config


async def login_start_handler(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    config = get_app_config()
    backend_url = config.get('backend_url', 'http://localhost:8000')

    token = get_user_token(user_id)
    if token:
        client = OpenJiuwenClient(base_url=backend_url)
        client.set_token(token)
        try:
            api_verify_token(client)
            await interaction.followup.send("✅ Already logged in. Use `/logout` to sign out.")
            return
        except Exception:
            remove_user_token(user_id)

    user_data = get_user_data(user_id)
    user_data['state'] = 'login_username'

    prompt = "🔐 **Login to OpenJiuwen Backend**\n\nPlease reply here with your username (email):"
    if not config.get('enable_password_login', False):
        prompt += "\n*No password required.*"

    try:
        await interaction.user.send(prompt)
        await interaction.followup.send("📨 Check your DMs to continue login.", ephemeral=True)
    except discord.Forbidden:
        user_data['state'] = 'idle'
        await interaction.followup.send(
            "❌ I couldn't send you a DM.\n"
            "Please enable **Allow direct messages from server members** in your Privacy Settings."
        )
