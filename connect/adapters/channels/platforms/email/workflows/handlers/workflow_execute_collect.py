"""Conversation step — collects workflow parameters one by one."""
from connect.client.workflows import ParamCollectionSession
from ...client_session import get_backend_client
from ._execute_and_reply import _execute_and_say


async def on_collect_param(user_id: str, text: str, say, user_data: dict) -> None:
    """Called from the message router when state == 'wf_collecting'."""
    session: ParamCollectionSession = user_data.get("wf_exec_session")
    if session is None or session.is_done:
        user_data["state"] = "idle"
        return

    if text.lower() == "skip":
        error, done = session.skip()
    else:
        error, done = session.submit(text)

    if error:
        await say(f"Warning: {error}")
        return

    if done:
        user_data.pop("wf_exec_session", None)
        user_data["state"] = "idle"
        client, err = get_backend_client(user_id)
        if err:
            await say(err)
            return
        await _execute_and_say(say, client, session.workflow_id, session.get_collected())
        return

    await say(session.format_prompt(session.answered + 1, session.total))
