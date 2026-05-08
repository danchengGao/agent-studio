from openjiuwen.core.common.logging import logger

from .auth.commands_printer import SECTIONS as AUTH_SECTIONS
from .workflows.commands_printer import SECTIONS as WORKFLOW_SECTIONS
from .agents.commands_printer import SECTIONS as AGENT_SECTIONS
from .general.commands_printer import SECTIONS as GENERAL_SECTIONS

_ALL_SECTIONS = AUTH_SECTIONS + AGENT_SECTIONS + WORKFLOW_SECTIONS + GENERAL_SECTIONS


def print_bot_commands():
    for title, commands in _ALL_SECTIONS:
        logger.info(f"{title}:")
        for cmd, desc in commands:
            logger.info(f"  {cmd} - {desc}")
        logger.info("")
