"""Prints available commands to stdout on startup."""

from openjiuwen.core.common.logging import logger


def print_bot_commands() -> None:
    logger.info("""
  Google Assistant Commands (speak these)
  ----------------------------------------
  Auth:      login | logout | status | cancel
  Workflows: workflows | workflows search <q> | workflow execute <id>
             workflow skip | workflow cancel
  Agents:    agents | agents search <q> | agent execute <id> <msg>
             agent start <id> | agent end
  General:   help | health
    """.strip())
