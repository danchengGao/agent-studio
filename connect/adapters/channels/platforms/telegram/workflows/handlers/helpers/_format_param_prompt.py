from connect.client.workflows import ParamCollectionSession
from ...commands import WORKFLOW_SKIP


def _format_param_prompt(session: ParamCollectionSession, index: int) -> str:
    """Format a parameter prompt using the session's built-in formatter."""
    return session.format_prompt(index, session.total, skip_command=WORKFLOW_SKIP)
