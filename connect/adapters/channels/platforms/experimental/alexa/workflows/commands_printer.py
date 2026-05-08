from openjiuwen.core.common.logging import logger


def print_workflows_commands() -> None:
    logger.info("  Workflow commands (voice):")
    logger.info("    workflows                  List all workflows")
    logger.info("    workflows search <query>   Search workflows")
    logger.info("    workflow run <name>        Run a workflow by name")
    logger.info("    skip                       Skip optional parameter")
