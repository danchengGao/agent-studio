async def handle_chat_end(user_id, say, user_data):
    user_data.pop("agent_chat", None)
    user_data["state"] = "idle"
    await say("Chat session ended. Say agent start followed by an ID to begin a new one.")
