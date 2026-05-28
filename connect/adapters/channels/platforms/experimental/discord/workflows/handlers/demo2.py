"""Demo 2 slash command handler."""
import discord
from openjiuwen.core.common.logging import logger


async def demo2_handler(interaction: discord.Interaction) -> None:
    """Demo 2 - /demo2"""
    message = "🚀 Demo 2 Will be triggered here"
    logger.info(message)
    await interaction.response.send_message(message, ephemeral=True)
