"""
Thin wrapper around the Meta Messenger Platform API.

Docs: https://developers.facebook.com/docs/messenger-platform/send-messages
"""
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Any, Dict

from openjiuwen.core.common.logging import logger


GRAPH_API_VERSION = "v18.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# Messenger text message limit (characters)
_MAX_MSG_LEN = 2000


def send_text_message(
    page_access_token: str,
    recipient_psid: str,
    text: str,
) -> Dict[str, Any]:
    """Send a plain-text Messenger message to a recipient by PSID.

    Long messages are automatically truncated to 2000 characters.
    """
    if len(text) > _MAX_MSG_LEN:
        text = text[:_MAX_MSG_LEN - 3] + '...'

    url = f"{GRAPH_API_BASE}/me/messages?access_token={urllib.parse.quote(page_access_token)}"
    payload = {
        "recipient": {"id": recipient_psid},
        "message": {"text": text},
        "messaging_type": "RESPONSE",
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("Messenger API error %s: %s", e.code, body)
        raise


def mark_as_seen(
    page_access_token: str,
    recipient_psid: str,
) -> None:
    """Send a 'mark seen' sender action (shows 'seen' indicator)."""
    url = f"{GRAPH_API_BASE}/me/messages?access_token={urllib.parse.quote(page_access_token)}"
    payload = {
        "recipient": {"id": recipient_psid},
        "sender_action": "mark_seen",
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception as e:
        logger.debug("mark_as_seen failed (non-critical): %s", e)
