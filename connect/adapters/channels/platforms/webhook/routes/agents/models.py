"""Agent request models."""
from pydantic import BaseModel


class RunRequest(BaseModel):
    agent_id: str
    message: str
    conversation_id: str = ""
