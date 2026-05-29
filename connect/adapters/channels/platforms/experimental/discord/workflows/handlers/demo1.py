"""Demo 1 slash command handler."""
import discord
from openjiuwen.core.common.logging import logger


async def demo1_handler(interaction: discord.Interaction) -> None:
    """Demo 1 - /demo1"""
    message = "✅ Demo 1 Will be triggered here"
    logger.info(message)
    await interaction.response.send_message(message, ephemeral=True)
