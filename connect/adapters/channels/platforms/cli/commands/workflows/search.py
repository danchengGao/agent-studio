"""Workflow search command."""
from openjiuwen.core.common.logging import logger
from connect.client.workflows import search_workflows

from ...session import require_client
from ...output import print_workflows


def cmd_workflow_search(backend_url: str, keyword: str) -> None:
    client = require_client(backend_url)
    try:
        result = search_workflows(client, keyword)
        data = result.get('data', {})
        workflows = data.get('workflow_list', data.get('workflows', []))
        if not workflows:
            logger.info(f"ℹ️  No workflows found matching '{keyword}'.")
            return
        print_workflows(workflows)
    except Exception as e:
        error = f"❌ {e}"
        logger.error(error)
        raise RuntimeError(error) from e
