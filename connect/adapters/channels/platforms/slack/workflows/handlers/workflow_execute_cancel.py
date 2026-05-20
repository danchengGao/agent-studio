from ...state import get_user_data


def handle_cancel(ack, respond, command):
    ack()
    user_id = command['user_id']
    user_data = get_user_data(user_id)
    user_data.pop('wf_exec_session', None)
    user_data['state'] = 'idle'
    respond("❌ Workflow execution cancelled.")