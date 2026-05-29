"""Health check slash command handler."""
import discord

from connect.client import OpenJiuwenClient
from connect.client.general.health_check import health_check
from ...state import get_app_config


async def health_handler(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    backend_url = get_app_config().get('backend_url', 'http://localhost:8000')
    client = OpenJiuwenClient(base_url=backend_url)
    try:
        result = health_check(client)
        status = result.get('status', 'unknown')
        await interaction.followup.send(f"✅ Backend Status: `{status}`")
    except Exception as e:
        await interaction.followup.send(f"❌ Backend is not healthy: {e}")
