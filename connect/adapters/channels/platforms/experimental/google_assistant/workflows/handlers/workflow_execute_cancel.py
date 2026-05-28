async def handle_cancel(user_id, say, user_data):
    user_data.pop("wf_exec_session", None)
    user_data["state"] = "idle"
    await say("Workflow execution cancelled.")
