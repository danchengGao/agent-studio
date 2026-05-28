"""
Amazon Alexa Skills Kit request/response models.

Reference:
  https://developer.amazon.com/en-US/docs/alexa/custom-skills/request-and-response-json-reference.html

Only the fields we actually use are modelled. Pydantic is used so FastAPI
can parse and validate the body automatically.
"""
import re
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


# ── Inbound (Alexa → us) ─────────────────────────────────────────────────────

class AlexaUser(BaseModel):
    userId: str = ""


class AlexaSession(BaseModel):
    sessionId: str = ""
    user: AlexaUser = Field(default_factory=AlexaUser)


class AlexaSlotValue(BaseModel):
    name: str = ""
    value: Optional[str] = None


class AlexaIntent(BaseModel):
    name: str = ""
    slots: Dict[str, AlexaSlotValue] = {}


class AlexaRequest(BaseModel):
    type: str = ""        # LaunchRequest, IntentRequest, SessionEndedRequest
    requestId: str = ""
    intent: Optional[AlexaIntent] = None


class AlexaSkillRequest(BaseModel):
    version: str = "1.0"
    session: AlexaSession = Field(default_factory=AlexaSession)
    request: AlexaRequest = Field(default_factory=AlexaRequest)


# ── Outbound (us → Alexa) ────────────────────────────────────────────────────

def make_response(
    text: str,
    should_end_session: bool = False,
    session_attributes: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a standard Alexa JSON response."""
    clean = _strip_markdown(text)
    return {
        "version": "1.0",
        "sessionAttributes": session_attributes or {},
        "response": {
            "outputSpeech": {
                "type": "PlainText",
                "text": clean,
            },
            "shouldEndSession": should_end_session,
        },
    }


def make_end_response(text: str = "") -> Dict[str, Any]:
    """Build a session-ending Alexa response."""
    return make_response(text or "Goodbye!", should_end_session=True)


def extract_command(body: AlexaSkillRequest) -> Optional[str]:
    """Extract the user's spoken command from an IntentRequest.

    Looks for a slot named 'Command' (or 'Query' or 'Text') in the intent.
    Returns None if not found or empty.
    """
    if body.request.type != "IntentRequest":
        return None
    intent = body.request.intent
    if intent is None:
        return None
    # Try common slot names
    for slot_name in ('Command', 'Query', 'Text', 'Input'):
        slot = intent.slots.get(slot_name)
        if slot and slot.value:
            return slot.value.strip()
    return None


def _strip_markdown(text: str) -> str:
    # Added whitespace after commas for better readability
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"#{1,6}\s+", "", text)
    text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)
    return text.strip()
