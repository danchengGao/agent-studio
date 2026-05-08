"""
Thin wrapper around the Meta WhatsApp Cloud API.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
"""
from typing import Dict, Any

import requests

from openjiuwen.core.common.logging import logger


GRAPH_API_VERSION = "v19.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# WhatsApp text body limit (characters)
_MAX_BODY_LEN = 4096


def send_text_message(
    access_token: str,
    phone_number_id: str,
    to: str,
    text: str,
) -> Dict[str, Any]:
    """Send a plain-text WhatsApp message.

    Long messages are automatically truncated to WhatsApp's 4096-char limit.
    """
    if len(text) > _MAX_BODY_LEN:
        text = text[:_MAX_BODY_LEN - 3] + '...'

    url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    response = requests.post(url, json=payload, headers=headers, timeout=15)
    response.raise_for_status()
    return response.json()


def mark_as_read(
    access_token: str,
    phone_number_id: str,
    message_id: str,
) -> None:
    """Mark an incoming message as read (shows double blue ticks)."""
    url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id,
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    try:
        requests.post(url, json=payload, headers=headers, timeout=5)
    except Exception as e:
        logger.debug("mark_as_read failed (non-critical): %s", e)
