"""
Pure workflow result parsing — no platform dependencies.
Extracts the final outputs from SSE events returned by execute_workflow().
"""
from typing import Dict, Any, List, Optional, Tuple


def parse_workflow_result(
    events: List[Dict[str, Any]],
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Parse SSE events from a workflow execution.

    Returns:
        (outputs, error)
        - (outputs_dict, None) — success; outputs may be empty {}
        - (None, error_msg)   — execution failed
    """
    # Check for any error event
    error_event = next(
        (ev for ev in events if ev.get('code', 200) != 200),
        None,
    )
    if error_event:
        return None, error_event.get('message', 'Unknown error')

    # Find the End node's finish trace — that holds the final outputs
    end_finish = None
    for ev in reversed(events):
        event_data = ev.get('data', {})
        is_trace = event_data.get('type') == 'trace'
        is_finish = event_data.get('payload', {}).get('status') == 'finish'

        if is_trace and is_finish:
            end_finish = ev
            break

    if not end_finish:
        return {}, None  # execution succeeded but End node not found

    outputs = end_finish['data']['payload'].get('outputs') or {}
    if isinstance(outputs, dict):
        # Unwrap single-key dicts one level (e.g. {"result": {"result": "9"}} → "9")
        outputs = {
            key: (next(iter(val.values())) if isinstance(val, dict) and len(val) == 1 else val)
            for key, val in outputs.items()
        }

    return outputs, None
