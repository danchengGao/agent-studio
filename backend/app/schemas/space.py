from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.user import RoleType


class SpaceStatus(BaseModel):
    workflow_num: int = 0
    agent_num: int = 0
    recent_workflow: int = -1
    recent_workflow: int = -1


class SpaceBase(BaseModel):
    space_id: str
    spacename: str = Field(..., min_length=3, max_length=50)
    description: str
    avatar_url: Optional[str] = None
    role_type: RoleType


class SpaceDBPd(SpaceBase):
    user_id_str: str
    creator_id_str: str
    space_create_time: int
    space_update_time: int


class SpaceInfo(SpaceBase):
    app_ids: Optional[str] = None
    space_type: Optional[int] = 1
    connectors: Optional[str] = None
    hide_operation: Optional[bool] = False
    display_local_plugin: Optional[bool] = False
    status: Optional[SpaceStatus] = SpaceStatus()


class SpaceResponse(BaseModel):
    space_list: List[SpaceInfo]
    has_personal_space: bool
    team_space_num: int
    recently_used_space_list: List[SpaceInfo]
    space_total_num: int
    has_more: bool


class SpaceAWPQuery(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    space_id: str = Field(..., min_length=1, max_length=100)
    page_size: int = 1000
    page: int = 1
    sort_by: Optional[str] = Field("update_time", description="排序字段")
    sort_order: Optional[str] = Field("desc", description="排序方向")
    publish_status: Optional[bool] = None
    search_term: Optional[str] = Field("", description="搜索关键词（支持名称、描述）")
    status_filter: Optional[str] = Field("all", description="状态过滤")

