"""Run workflow slash command handler — starts execution or collects params via DM."""
import discord
from discord import app_commands

from connect.client.workflows.get_workflow import get_workflow
from connect.client.workflows import ParamCollectionSession
from ...client_session import get_backend_client
from ...state import get_user_data
from ._execute_and_reply import _execute_and_followup


@app_commands.describe(workflow_id="The workflow ID to run")
async def workflow_execute_handler(interaction: discord.Interaction, workflow_id: str) -> None:
    await interaction.response.defer(ephemeral=True)
    user_id = str(interaction.user.id)
    client, err = get_backend_client(user_id)
    if err:
        await interaction.followup.send(err)
        return
    try:
        result = get_workflow(client, workflow_id)
        wf_data = result.get('data', {}).get('workflow', {})
        params = wf_data.get('input_parameters', [])
    except Exception as e:
        await interaction.followup.send(f"❌ Could not fetch workflow info: {e}")
        return

    if not params:
        await _execute_and_followup(interaction, client, workflow_id, {})
        return

    session = ParamCollectionSession(workflow_id, params)
    user_data = get_user_data(user_id)
    user_data['wf_exec_session'] = session
    user_data['state'] = 'wf_collecting'

    wf_name = wf_data.get('name', workflow_id)
    prompt = (
        f"⚙️ **{wf_name}** needs {session.total} parameter(s).\n"
        f"Reply here with each value. Type `skip` to skip optional params, "
        f"or `/workflow_cancel` to abort.\n\n"
        + session.format_prompt(1, session.total)
    )
    try:
        await interaction.user.send(prompt)
        await interaction.followup.send("📨 Check your DMs to provide the workflow parameters.")
    except discord.Forbidden:
        user_data.pop('wf_exec_session', None)
        user_data['state'] = 'idle'
        await interaction.followup.send(
            "❌ I couldn't send you a DM.\n"
            "Please enable **Allow direct messages from server members** in your Privacy Settings."
        )
