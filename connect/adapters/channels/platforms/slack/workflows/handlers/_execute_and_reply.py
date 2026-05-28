from connect.client.workflows.execute_workflow import execute_workflow
from connect.client.workflows import parse_workflow_result


def _execute_and_reply(client, workflow_id: str, inputs: dict, respond) -> None:
    respond(f"🚀 Executing with inputs: `{inputs}`" if inputs else "🚀 Executing workflow...")
    events = execute_workflow(client, workflow_id, inputs)
    outputs, error = parse_workflow_result(events)

    if error:
        respond(f"❌ Execution failed: {error}")
        return

    lines = ["✅ *Workflow executed successfully!*\n"]
    if outputs:
        for key, val in outputs.items():
            lines.append(f"*{key}:*\n{str(val)[:500]}")
    else:
        lines.append(f"_Received {len(events)} trace event(s) — no output found._")
    respond('\n'.join(lines))