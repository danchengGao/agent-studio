def _cleanup_exec_state(context):
    """Remove workflow execution state from Telegram user context."""
    context.user_data.pop('wf_exec_session', None)
