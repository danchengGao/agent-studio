from openjiuwen.core.common.logging import logger


def print_agents_commands() -> None:
    logger.info("  Agent commands (voice):")
    logger.info("    agents                   List all agents")
    logger.info("    agent run <name>         Start an agent chat session")
    logger.info("    agent end                End the current agent chat")
