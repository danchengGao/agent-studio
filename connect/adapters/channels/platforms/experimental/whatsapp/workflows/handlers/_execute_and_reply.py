"""Shared execution helper — run a workflow and format the result."""
from connect.client.workflows.execute_workflow import execute_workflow
from connect.client.workflows import parse_workflow_result


async def _execute_and_say(say, client, workflow_id: str, inputs: dict) -> None:
    await say(f"🚀 Executing with inputs: {inputs}" if inputs else "🚀 Executing workflow...")
    events = execute_workflow(client, workflow_id, inputs)
    outputs, error = parse_workflow_result(events)
    if error:
        await say(f"❌ Execution failed: {error}")
        return
    lines = ["✅ *Workflow executed successfully!*\n"]
    if outputs:
        for key, val in outputs.items():
            lines.append(f"*{key}:*\n{str(val)[:500]}")
    else:
        lines.append(f"_Received {len(events)} trace event(s) — no output found._")
    await say('\n'.join(lines))
