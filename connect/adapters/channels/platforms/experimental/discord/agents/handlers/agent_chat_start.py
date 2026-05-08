"""Start agent chat slash command handler — opens a DM chat session."""
import discord
from discord import app_commands

from ...client_session import get_backend_client
from ...state import get_user_data


@app_commands.describe(agent_id="The agent ID to chat with")
async def agent_chat_start_handler(interaction: discord.Interaction, agent_id: str) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    client, err = get_backend_client(user_id)
    if err:
        await interaction.followup.send(err)
        return
    user_data = get_user_data(user_id)
    user_data['agent_chat'] = {'agent_id': agent_id, 'conversation_id': ''}
    user_data['state'] = 'agent_chat'
    try:
        await interaction.user.send(
            f"🤖 Started chat with agent `{agent_id}`.\n"
            f"Reply here to send messages. Use `/agent_end_chat` to finish."
        )
        await interaction.followup.send("📨 Chat session started in your DMs.")
    except discord.Forbidden:
        user_data['state'] = 'idle'
        user_data.pop('agent_chat', None)
        await interaction.followup.send(
            "❌ I couldn't send you a DM.\n"
            "Please enable **Allow direct messages from server members** in your Privacy Settings."
        )
