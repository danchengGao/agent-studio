from openjiuwen.core.common.logging import logger


async def execute_and_reply(client, workflow: dict, params: dict, say) -> None:
    wf_name = workflow.get('name', 'unknown')
    await say(f"Running workflow {wf_name}.")
    try:
        result = client.run_workflow(workflow_id=workflow.get('id'), params=params)
        output = result.get('output') or result.get('result') or str(result)
        await say(f"Result: {output}")
    except Exception as e:
        logger.error("Workflow execution error: %s", e)
        await say(f"Workflow failed. {e}")
