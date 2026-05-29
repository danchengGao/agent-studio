from connect.client.workflows.execute_workflow import execute_workflow
from connect.client.workflows import parse_workflow_result


async def _execute_and_say(say, client, workflow_id, inputs):
    await say("Executing the workflow now. Please wait.")
    events = execute_workflow(client, workflow_id, inputs)
    outputs, error = parse_workflow_result(events)
    if error:
        await say(f"Execution failed: {error}")
        return
    if outputs:
        parts = ["Workflow completed successfully."]
        for key, val in outputs.items():
            parts.append(f"{key}: {str(val)[:300]}")
        await say("\n".join(parts))
    else:
        await say(f"Workflow completed. Received {len(events)} events but no output was found.")
