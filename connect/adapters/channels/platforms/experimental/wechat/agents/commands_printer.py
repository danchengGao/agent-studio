from openjiuwen.core.common.logging import logger


def print_agents_commands() -> None:
    logger.info("  Agent commands:")
    logger.info("    agents                   List all agents")
    logger.info("    agents search <query>    Search agents")
    logger.info("    agent run <name>         Start an agent chat session")
