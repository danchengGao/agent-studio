"""
Pure agent response parsing — no platform dependencies.
Extracts the agent's text reply and conversation ID from SSE events.
"""
from typing import Dict, Any, List, Optional, Tuple


def parse_agent_response(
    events: List[Dict[str, Any]],
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse SSE events from an agent execution.

    Returns:
        (text, conversation_id, error)
        - (text, conv_id, None) — success
        - (None, None, error)   — agent returned an error event
    """
    # Check for error event
    error_event = next((ev for ev in events if ev.get('code', 200) != 200), None)
    if error_event:
        return None, None, error_event.get('message', 'Unknown error')

    # Extract conversation_id so callers can continue the thread
    conversation_id: Optional[str] = next(
        (
            ev.get('conversation_id') or ev.get('data', {}).get('conversation_id')
            for ev in reversed(events)
            if ev.get('conversation_id') or ev.get('data', {}).get('conversation_id')
        ),
        None,
    )

    def _payload_text(payload: dict) -> str:
        return payload.get('content', payload.get('output', ''))

    # Concatenate all agent tokens (streaming sends one token per event)
    joined = ''.join(
        _payload_text(ev.get('data', {}).get('payload', {}))
        for ev in events
        if ev.get('data', {}).get('type') == 'agent'
    ).strip()
    text: Optional[str] = joined or None

    return text, conversation_id, None
