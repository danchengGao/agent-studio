from connect.client.workflows import ParamCollectionSession
from ._execute_and_reply import _execute_and_reply
from ...client_session import get_backend_client


def on_collect_param(user_id: str, text: str, say, user_data: dict) -> None:
    """Called from the message router when state == 'wf_collecting'."""
    session: ParamCollectionSession = user_data.get('wf_exec_session')
    if session is None or session.is_done:
        user_data['state'] = 'idle'
        return

    if text.lower() in ('/workflow_skip', 'skip'):
        error, done = session.skip()
    else:
        error, done = session.submit(text)

    if error:
        say(f"⚠️ {error}")
        return

    if done:
        user_data.pop('wf_exec_session', None)
        user_data['state'] = 'idle'
        client = get_backend_client(user_id, say)
        if client:
            _execute_and_reply(client, session.workflow_id, session.get_collected(), say)
        return

    say(session.format_prompt(session.answered + 1, session.total))