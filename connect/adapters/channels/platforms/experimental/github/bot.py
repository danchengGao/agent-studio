"""Route GitHub slash commands to the appropriate handler."""
from .state import get_user_data
from .auth.handlers.login_start import handle_login_start
from .auth.handlers.login_username import handle_login_username
from .auth.handlers.login_password import handle_login_password
from .auth.handlers.logout import handle_logout
from .auth.handlers.status import handle_status
from .auth.handlers.cancel import handle_cancel
from .agents.handlers.agents_list import handle_agents_list
from .agents.handlers.agents_search import handle_agents_search
from .agents.handlers.agent_execute import handle_agent_execute
from .agents.handlers.agent_start_chat import handle_agent_start_chat
from .agents.handlers.agent_chat_message import handle_agent_chat_message
from .agents.handlers.agent_end_chat import handle_agent_end_chat
from .workflows.handlers.workflows_list import handle_workflows_list
from .workflows.handlers.workflows_search import handle_workflows_search
from .workflows.handlers.workflow_execute import handle_workflow_execute
from .workflows.handlers.workflow_execute_collect import handle_workflow_collect
from .workflows.handlers.workflow_execute_cancel import handle_workflow_cancel
from .general.handlers.health import handle_health
from .general.handlers.help import handle_help


async def handle_command(user_id: str, command: str, say) -> None:
    """Dispatch a slash command (without the leading slash) to the correct handler."""
    ud = get_user_data(user_id)

    # Multi-turn flows take priority
    if ud.get("state") == "awaiting_username":
        await handle_login_username(user_id, command, say)
        return
    if ud.get("state") == "awaiting_password":
        await handle_login_password(user_id, command, say)
        return
    if ud.get("workflow_session"):
        low = command.lower()
        if low in ("cancel", "workflow cancel"):
            await handle_workflow_cancel(user_id, command, say)
        elif low == "skip":
            await handle_workflow_collect(user_id, "SKIP", say)
        else:
            await handle_workflow_collect(user_id, command, say)
        return
    if ud.get("agent_chat"):
        low = command.lower()
        if low in ("end", "stop"):
            await handle_agent_end_chat(user_id, command, say)
        else:
            await handle_agent_chat_message(user_id, command, say)
        return

    parts = command.split(None, 2)
    cmd = parts[0].lower() if parts else ""
    sub = parts[1].lower() if len(parts) > 1 else ""
    arg = parts[2] if len(parts) > 2 else (parts[1] if len(parts) > 1 else "")

    if cmd == "login":
        await handle_login_start(user_id, command, say)
    elif cmd == "logout":
        await handle_logout(user_id, command, say)
    elif cmd == "status":
        await handle_status(user_id, command, say)
    elif cmd == "cancel":
        await handle_cancel(user_id, command, say)
    elif cmd == "health":
        await handle_health(user_id, command, say)
    elif cmd in ("help", "start"):
        await handle_help(user_id, command, say)
    elif cmd == "workflows" and not sub:
        await handle_workflows_list(user_id, command, say)
    elif cmd == "workflows" and sub == "search":
        await handle_workflows_search(user_id, arg, say)
    elif cmd == "workflow" and sub == "run":
        await handle_workflow_execute(user_id, arg, say)
    elif cmd == "agents" and not sub:
        await handle_agents_list(user_id, command, say)
    elif cmd == "agents" and sub == "search":
        await handle_agents_search(user_id, arg, say)
    elif cmd == "agent" and sub == "run":
        await handle_agent_execute(user_id, arg, say)
    elif cmd == "agent" and sub == "start":
        await handle_agent_start_chat(user_id, arg, say)
    elif cmd == "agent" and sub == "end":
        await handle_agent_end_chat(user_id, command, say)
    elif cmd == "skip":
        if ud.get("workflow_session"):
            await handle_workflow_collect(user_id, "SKIP", say)
        else:
            await say("Nothing to skip.")
    else:
        await say(f"Unknown command: `/{command}`. Comment `/help` to see available commands.")
