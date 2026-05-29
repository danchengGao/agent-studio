"""Terminal output formatting helpers."""
from typing import Any, Dict, List
from openjiuwen.core.common.logging import logger


def print_workflows(workflows: List[Dict], total: int = 0) -> None:
    total = total or len(workflows)
    logger.info(f"\n✅ {total} workflow(s):\n")
    for i, wf in enumerate(workflows, 1):
        name = wf.get('name', 'Unnamed')
        wf_id = wf.get('workflow_id', 'N/A')
        desc = wf.get('desc', '')
        logger.info(f"  {i:>2}. {name}")
        logger.info(f"       ID : {wf_id}")
        if desc:
            logger.info(f"       {desc[:100]}{'...' if len(desc) > 100 else ''}")
        logger.info("")


def print_agents(agents: List[Dict], total: int = 0) -> None:
    total = total or len(agents)
    logger.info(f"\n✅ {total} agent(s):\n")
    for i, agent in enumerate(agents, 1):
        icon = agent.get('icon', '🤖')
        name = agent.get('agent_name', 'Unnamed')
        agent_id = agent.get('agent_id', 'N/A')
        desc = agent.get('description', '')
        logger.info(f"  {i:>2}. {icon}  {name}")
        logger.info(f"       ID : {agent_id}")
        if desc:
            logger.info(f"       {desc[:100]}{'...' if len(desc) > 100 else ''}")
        logger.info("")


def print_outputs(outputs: Dict[str, Any]) -> None:
    if not outputs:
        logger.info("  (no outputs)")
        return
    for key, val in outputs.items():
        text = str(val)
        logger.info(f"\n  {key}:")
        # Indent multi-line values
        for line in text.splitlines():
            logger.info(f"    {line}")


def hr(char: str = "─", width: int = 60) -> None:
    logger.info(char * width)
