"""Start command handler — welcome message."""
from connect.client.auth.token_storage import get_user_token
from ...auth.commands_printer import SECTIONS as AUTH_SECTIONS
from ...workflows.commands_printer import SECTIONS as WORKFLOW_SECTIONS
from ...agents.commands_printer import SECTIONS as AGENT_SECTIONS
from ..commands_printer import SECTIONS as GENERAL_SECTIONS


def _format_sections(sections):
    lines = []
    for title, commands in sections:
        lines.append(f"**{title}**")
        for cmd, desc in commands:
            lines.append(f"  `{cmd}` — {desc}")
        lines.append("")
    return "\n".join(lines).rstrip()


async def handle_start(user_id: str, say, user_data: dict) -> None:
    """Welcome message - start"""
    token = get_user_token(user_id)

    if not token:
        message = (
            "🤖 **Welcome to OpenJiuwen Bot!**\n\n"
            "⚠️ You are not logged in. Type `login` to authenticate first.\n\n"
            + _format_sections(AUTH_SECTIONS)
            + "\n\nOnce logged in, you can use:\n\n"
            + _format_sections(AGENT_SECTIONS + WORKFLOW_SECTIONS + GENERAL_SECTIONS)
        )
    else:
        message = (
            "🤖 **Welcome to OpenJiuwen Bot!**\n\n"
            "✅ You are logged in!\n\n"
            + _format_sections(AUTH_SECTIONS + AGENT_SECTIONS + WORKFLOW_SECTIONS + GENERAL_SECTIONS)
        )

    await say(message)
