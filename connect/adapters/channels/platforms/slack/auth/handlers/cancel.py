from ...state import get_user_data


def handle_cancel(ack, respond, command):
    """Cancel any active operation and reset state to idle."""
    ack()
    user_id = command['user_id']
    user_data = get_user_data(user_id)
    state = user_data.get('state', 'idle')
    if state == 'idle':
        respond("ℹ️ Nothing to cancel.")
        return
    user_data.pop('login_username', None)
    user_data.pop('wf_exec_session', None)
    user_data.pop('agent_chat', None)
    user_data['state'] = 'idle'
    respond("🚫 Operation cancelled.")
