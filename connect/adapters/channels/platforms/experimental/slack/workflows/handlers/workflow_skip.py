from ...state import get_user_data


def handle_skip(ack, respond, command):
    """Skip the current optional workflow parameter collection step."""
    ack()
    user_id = command['user_id']
    user_data = get_user_data(user_id)
    if user_data.get('state') != 'wf_collecting':
        respond("ℹ️ No active workflow parameter collection to skip.")
        return
    from .workflow_execute_collect import on_collect_param
    on_collect_param(user_id, '/workflow_skip', respond, user_data)
