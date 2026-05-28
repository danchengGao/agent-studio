async def handle_cancel(user_id: str, say, user_data: dict) -> None:
    state = user_data.get("state", "idle")
    if state == "idle":
        await say("There is nothing to cancel.")
        return
    user_data.pop("login_username", None)
    user_data.pop("wf_exec_session", None)
    user_data.pop("agent_chat", None)
    user_data["state"] = "idle"
    await say("Operation cancelled.")
