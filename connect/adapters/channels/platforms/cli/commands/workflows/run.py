"""Workflow run command."""
from openjiuwen.core.common.logging import logger
from connect.client.workflows.get_workflow import get_workflow
from connect.client.workflows.execute_workflow import execute_workflow
from connect.client.workflows import ParamCollectionSession
from connect.client.workflows import parse_workflow_result

from ...session import require_client
from ...output import print_outputs, hr


def cmd_workflow_run(backend_url: str, workflow_id: str, raw_inputs: list) -> None:
    client = require_client(backend_url)

    # Parse --input KEY=VALUE pairs
    inputs: dict = {}
    for item in (raw_inputs or []):
        if '=' not in item:
            error = f"❌ Invalid --input format '{item}'. Use KEY=VALUE."
            logger.error(error)
            raise RuntimeError(error)
        k, _, v = item.partition('=')
        inputs[k.strip()] = v.strip()

    # Fetch workflow to check if it has required parameters not already supplied
    try:
        result = get_workflow(client, workflow_id)
        wf_data = result.get('data', {}).get('workflow', {})
        params = wf_data.get('input_parameters', [])
    except Exception as e:
        error = f"❌ Could not fetch workflow info: {e}"
        logger.error(error)
        raise RuntimeError(error) from e

    # Prompt interactively for any missing parameters
    missing = [p for p in params if p.get('name') not in inputs]
    if missing:
        session = ParamCollectionSession(workflow_id, missing)
        logger.info(f"\n⚙️  '{wf_data.get('name', workflow_id)}' needs {session.total} parameter(s).")
        logger.info("   (Press Enter to skip optional ones)\n")
        while not session.is_done:
            prompt = session.format_prompt(session.answered + 1, session.total, skip_command='Enter')
            logger.info(prompt)
            try:
                value = input("  Value: ").strip()
            except (KeyboardInterrupt, EOFError) as e:
                error = "\n❌ Cancelled."
                logger.error(error)
                raise RuntimeError(error) from e
            if not value:
                err, done = session.skip()
            else:
                err, done = session.submit(value)
            if err:
                logger.warning(f"  ⚠️  {err}")
        inputs.update(session.get_collected())

    logger.info(f"\n🚀 Running workflow {workflow_id}...")
    try:
        events = execute_workflow(client, workflow_id, inputs)
        outputs, error = parse_workflow_result(events)
    except Exception as e:
        error = f"❌ Execution error: {e}"
        logger.error(error)
        raise RuntimeError(error) from e

    if error:
        error = f"❌ Workflow failed: {error}"
        logger.error(error)
        raise RuntimeError(error)

    hr()
    logger.info("✅ Workflow completed successfully\n")
    print_outputs(outputs or {})
    hr()
