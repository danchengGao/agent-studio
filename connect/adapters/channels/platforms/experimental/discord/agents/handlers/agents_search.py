"""Search agents slash command handler."""
import discord
from discord import app_commands

from connect.client.agents import search_agents
from ...client_session import get_backend_client


@app_commands.describe(keyword="Search keyword")
async def agents_search_handler(interaction: discord.Interaction, keyword: str) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    client, err = get_backend_client(user_id)
    if err:
        await interaction.followup.send(err)
        return
    try:
        result = search_agents(client, keyword)
        agents = result.get('data', {}).get('agent_items', [])
        if not agents:
            await interaction.followup.send(f"ℹ️ No agents found matching `{keyword}`.")
            return
        lines = [f"🔍 Found {len(agents)} agent(s) matching `{keyword}`:\n"]
        for i, agent in enumerate(agents[:10], 1):
            icon = agent.get('icon', '🤖')
            name = agent.get('agent_name', 'Unnamed')
            agent_id = agent.get('agent_id', 'N/A')
            lines.append(f"{i}. {icon} **{name}**  |  ID: `{agent_id}`")
        await interaction.followup.send('\n'.join(lines))
    except Exception as e:
        await interaction.followup.send(f"❌ Error: {e}")
