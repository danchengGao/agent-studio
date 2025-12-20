from enum import Enum
from pydantic import BaseModel, Field


class MemberType(str, Enum):
    AGENT = "AGENT"
    WORKFLOW = "WORKFLOW"
    PROMPT = "PROMPT"


class RelatedMemberInfo(BaseModel):
    id: str
    version: str
    name: str
    type: MemberType