async def handle_skip(user_id, say, user_data):
    if user_data.get("state") != "wf_collecting":
        await say("There is no active workflow parameter collection to skip.")
        return
    from .workflow_execute_collect import on_collect_param
    await on_collect_param(user_id, "skip", say, user_data)
