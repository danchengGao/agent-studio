"""End agent chat command handler."""


async def handle_chat_end(user_id: str, say, user_data: dict) -> None:
    user_data.pop('agent_chat', None)
    user_data['state'] = 'idle'
    await say("👋 Chat session ended. Send *agent chat <id>* to start a new one.")
