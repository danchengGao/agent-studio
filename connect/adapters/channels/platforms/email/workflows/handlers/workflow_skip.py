"""Skip the current optional workflow parameter."""
from ...state import get_user_data


async def handle_skip(user_id: str, say, user_data: dict) -> None:
    if user_data.get("state") != "wf_collecting":
        await say("No active workflow parameter collection to skip.")
        return
    from .workflow_execute_collect import on_collect_param
    await on_collect_param(user_id, "skip", say, user_data)
