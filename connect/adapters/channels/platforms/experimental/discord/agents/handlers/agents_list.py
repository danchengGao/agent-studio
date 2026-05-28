"""List agents slash command handler."""
import discord

from connect.client.agents import list_agents
from ...client_session import get_backend_client


async def agents_list_handler(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    client, err = get_backend_client(user_id)
    if err:
        await interaction.followup.send(err)
        return
    try:
        result = list_agents(client)
        data = result.get('data', {})
        agents = data.get('agent_items', [])
        total = data.get('pagination', {}).get('total', len(agents))
        if not agents:
            await interaction.followup.send("ℹ️ No agents found.")
            return
        lines = [f"✅ Found {total} agent(s):\n"]
        for i, agent in enumerate(agents[:10], 1):
            icon = agent.get('icon', '🤖')
            name = agent.get('agent_name', 'Unnamed')
            agent_id = agent.get('agent_id', 'N/A')
            desc = agent.get('description', '')
            lines.append(f"{i}. {icon} **{name}**  |  ID: `{agent_id}`")
            if desc:
                lines.append(f"   *{desc[:60]}{'...' if len(desc) > 60 else ''}*")
        if total > 10:
            lines.append(f"*...and {total - 10} more*")
        lines.append("\n💡 Chat: `/agent_chat agent_id:<id>`  or  Single run: `/agent_run agent_id:<id> message:<msg>`")
        await interaction.followup.send('\n'.join(lines))
    except Exception as e:
        await interaction.followup.send(f"❌ Error: {e}")
