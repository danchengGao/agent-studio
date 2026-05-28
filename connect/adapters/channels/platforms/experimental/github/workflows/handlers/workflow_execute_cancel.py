"""Cancel an active workflow parameter collection."""
from ...state import get_user_data


async def handle_workflow_cancel(user_id: str, text: str, say) -> None:
    ud = get_user_data(user_id)
    if "workflow_session" in ud:
        del ud["workflow_session"]
        ud.pop("workflow_client_config", None)
        await say("Workflow cancelled.")
    else:
        await say("No active workflow to cancel.")
