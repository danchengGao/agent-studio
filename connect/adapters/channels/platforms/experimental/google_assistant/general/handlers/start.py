async def handle_start(user_id, say, user_data):
    await say(
        "Welcome to OpenJiuwen on Google Assistant. "
        "You can run workflows and chat with agents using your voice. "
        "Say help to hear all available commands, or say login to get started."
    )
