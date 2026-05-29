"""Cancel workflow parameter collection command handler."""


async def handle_cancel(user_id: str, say, user_data: dict) -> None:
    user_data.pop('wf_exec_session', None)
    user_data['state'] = 'idle'
    await say("❌ Workflow execution cancelled.")
