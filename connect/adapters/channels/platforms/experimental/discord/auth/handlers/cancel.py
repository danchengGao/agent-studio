import discord

from ...state import get_user_data


async def cancel_handler(interaction: discord.Interaction) -> None:
    """Cancel any active operation and reset state to idle."""
    user_id = str(interaction.user.id)
    user_data = get_user_data(user_id)
    state = user_data.get('state', 'idle')
    if state == 'idle':
        await interaction.response.send_message("ℹ️ Nothing to cancel.", ephemeral=True)
        return
    user_data.pop('login_username', None)
    user_data.pop('wf_exec_session', None)
    user_data.pop('agent_chat', None)
    user_data['state'] = 'idle'
    await interaction.response.send_message("🚫 Operation cancelled.", ephemeral=True)
