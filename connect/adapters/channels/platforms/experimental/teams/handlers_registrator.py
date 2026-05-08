"""Routes incoming Teams messages to the appropriate module handlers."""
from .agents import handlers_registrator as agents_hr
from .auth import handlers_registrator as auth_hr
from .general import handlers_registrator as general_hr
from .workflows import handlers_registrator as workflows_hr
from .auth.handlers import on_login_username, on_login_password
from .workflows.handlers import on_collect_param
from .agents.handlers import on_agent_message
from ...command_context import CommandContext

_COMMAND_MODULES = [general_hr, auth_hr, workflows_hr, agents_hr]


async def route_message(text: str, user_id: str, say, user_data: dict) -> None:
    """Dispatch a message to the correct handler based on state or command text."""
    state = user_data.get('state', 'idle')

    # ── State-based routing ────────────────────────────────────────────────
    if state == 'login_username':
        await on_login_username(user_id, text, say, user_data)
        return
    if state == 'login_password':
        await on_login_password(user_id, text, say, user_data)
        return
    if state == 'wf_collecting':
        await on_collect_param(user_id, text, say, user_data)
        return
    if state == 'agent_chat':
        await on_agent_message(user_id, text, say, user_data)
        return

    # ── Command routing ────────────────────────────────────────────────────
    parts = text.split(None, 3)
    cmd1 = parts[0].lower() if parts else ''
    cmd2 = parts[1].lower() if len(parts) > 1 else ''

    for module in _COMMAND_MODULES:
        if await module.handle_command(CommandContext(cmd1=cmd1, cmd2=cmd2, parts=parts, user_id=user_id, say=say,
                                                      user_data=user_data)):
            return

    await say(
        f"Unknown command: `{text}`\n\n"
        "Type `help` to see all available commands."
    )
