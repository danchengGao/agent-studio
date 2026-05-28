"""
Google Actions SDK v3 fulfillment request / response models.

Reference:
  https://developers.google.com/assistant/conversational/fulfillment-library/reference/rest/v1/TopLevel

Only the fields we actually use are modelled.  Pydantic is used so FastAPI
can parse and validate the body automatically.
"""
import re
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


# ── Inbound (Google → us) ────────────────────────────────────────────────────

class IntentData(BaseModel):
    name: str = ""
    query: str = ""                # The user's raw speech / text
    params: Dict[str, Any] = {}


class SessionData(BaseModel):
    id: str = ""
    params: Dict[str, Any] = {}


class UserData(BaseModel):
    locale: str = "en-US"
    params: Dict[str, Any] = {}


class HandlerData(BaseModel):
    name: str = ""


class FulfillmentRequest(BaseModel):
    handler: HandlerData = Field(default_factory=HandlerData)
    intent: IntentData = Field(default_factory=IntentData)
    session: SessionData = Field(default_factory=SessionData)
    user: UserData = Field(default_factory=UserData)


# ── Outbound (us → Google) ───────────────────────────────────────────────────

class SimpleResponse(BaseModel):
    speech: str
    text: str


class Prompt(BaseModel):
    override: bool = False
    firstSimple: SimpleResponse


class SessionOut(BaseModel):
    id: str
    params: Dict[str, Any] = {}


class FulfillmentResponse(BaseModel):
    session: SessionOut
    prompt: Prompt


def make_response(session_id: str, text: str) -> FulfillmentResponse:
    """Build a standard text fulfillment response."""
    # Google TTS chokes on some markdown chars — strip the worst ones.
    clean = _strip_markdown(text)
    return FulfillmentResponse(
        session=SessionOut(id=session_id),
        prompt=Prompt(firstSimple=SimpleResponse(speech=clean, text=clean)),
    )


def _strip_markdown(text: str) -> str:
    # Added a single space after each comma for clarity
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    return text
