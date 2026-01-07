from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class TagStatus(str, Enum):
    """Tag status enumeration."""
    ACTIVE = "active"
    INACTIVE = "inactive"


class TagBase(BaseModel):
    """Base tag schema with common fields."""
    space_id: str = Field(..., min_length=1, max_length=100, description="Space identifier")
    tag_name: str = Field(..., min_length=1, max_length=100, description="Tag name")
    tag_color: Optional[str] = Field(None, max_length=20, description="Tag color code (e.g., #FF5733)")
    is_active: bool = Field(True, description="Whether the tag is active")
    create_user: Optional[str] = Field(None, max_length=100, description="Creator user ID")
    update_user: Optional[str] = Field(None, max_length=100, description="Updater user ID")

    @field_validator('tag_color')
    @classmethod
    def validate_tag_color(cls, v):
        """Validate tag color format."""
        if v is not None and not v.startswith('#'):
            raise ValueError('Tag color must start with #')
        if v is not None and len(v) not in [4, 7]:  # #RGB or #RRGGBB
            raise ValueError('Tag color must be in #RGB or #RRGGBB format')
        return v

    @field_validator('tag_name')
    @classmethod
    def validate_tag_name(cls, v):
        """Validate tag name."""
        if not v.strip():
            raise ValueError('Tag name cannot be empty or whitespace')
        return v.strip()


class TagCreate(TagBase):
    """Tag creation schema."""
    pass


class TagUpdate(BaseModel):
    """Tag update schema."""
    tag_name: Optional[str] = Field(None, min_length=1, max_length=100, description="New tag name")
    tag_color: Optional[str] = Field(None, max_length=20, description="New tag color")
    is_active: Optional[bool] = Field(None, description="Active status")
    update_user: Optional[str] = Field(None, max_length=100, description="Updater user ID")

    @field_validator('tag_color')
    @classmethod
    def validate_tag_color(cls, v):
        """Validate tag color format."""
        if v is not None and not v.startswith('#'):
            raise ValueError('Tag color must start with #')
        if v is not None and len(v) not in [4, 7]:
            raise ValueError('Tag color must be in #RGB or #RRGGBB format')
        return v

    @field_validator('tag_name')
    @classmethod
    def validate_tag_name(cls, v):
        """Validate tag name."""
        if v is not None:
            if not v.strip():
                raise ValueError('Tag name cannot be empty or whitespace')
            return v.strip()
        return v


class TagResponse(TagBase):
    """Tag response schema."""
    primary_id: int = Field(..., description="Primary tag ID")
    usage_count: int = Field(0, description="Number of times this tag has been used")
    create_time: Optional[int] = Field(None, description="Creation timestamp")
    update_time: Optional[int] = Field(None, description="Last update timestamp")

    class Config:
        from_attributes = True


class TagListResponse(BaseModel):
    """Tag list response schema."""
    tags: List[TagResponse] = Field(..., description="List of tags")
    total: int = Field(..., description="Total number of tags")
    page: int = Field(1, description="Page number")
    page_size: int = Field(100, description="Page size")


class TagQuery(BaseModel):
    """Tag query parameters schema."""
    space_id: str = Field(..., min_length=1, max_length=100, description="Space identifier")
    tag_name: Optional[str] = Field(None, max_length=100, description="Filter by tag name")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(100, ge=1, le=1000, description="Page size")


class TagSearchQuery(BaseModel):
    """Tag search query schema."""
    space_id: str = Field(..., min_length=1, max_length=100, description="Space identifier")
    search_pattern: str = Field(..., min_length=1, max_length=100, description="Search pattern")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(100, ge=1, le=1000, description="Page size")


class TagIdQuery(BaseModel):
    """Tag ID query schema."""
    primary_id: Optional[int] = Field(None, description="Primary tag ID")
    space_id: Optional[str] = Field(None, max_length=100, description="Space identifier")
    tag_name: Optional[str] = Field(None, max_length=100, description="Tag name")

    @field_validator('primary_id', 'space_id', 'tag_name')
    @classmethod
    def validate_query_fields(cls, v, info):
        """Ensure at least one query field is provided."""
        if v is None:
            return v
        field_name = info.field_name
        if field_name == 'primary_id' and v <= 0:
            raise ValueError('Primary ID must be positive')
        return v


class TagDeleteQuery(BaseModel):
    """Tag deletion query schema."""
    space_id: str = Field(..., min_length=1, max_length=100, description="Space identifier")
    tag_name: str = Field(..., min_length=1, max_length=100, description="Tag name")


class TagGetOrCreateRequest(TagBase):
    """Tag get or create request schema."""
    pass


class TagGetOrCreateResponse(BaseModel):
    """Tag get or create response schema."""
    tag: TagResponse = Field(..., description="Tag information")
    created: bool = Field(..., description="Whether the tag was newly created")


class TagBatchCreateRequest(BaseModel):
    """Batch tag creation request schema."""
    tags: List[TagCreate] = Field(..., min_length=1, max_length=100, description="List of tags to create")

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        """Validate tags list."""
        if not v:
            raise ValueError('Tags list cannot be empty')
        if len(v) > 100:
            raise ValueError('Cannot create more than 100 tags at once')

        # Check for duplicate tag names within the same space
        space_tags = {}
        for tag in v:
            key = (tag.space_id, tag.tag_name)
            if key in space_tags:
                raise ValueError('Duplicate tag name in space')
            space_tags[key] = tag

        return v


class TagBatchCreateResponse(BaseModel):
    """Batch tag creation response schema."""
    created_tags: List[TagResponse] = Field(..., description="Successfully created tags")
    failed_tags: List[Dict[str, Any]] = Field(..., description="Failed tag creation attempts")
    total_created: int = Field(..., description="Total number of tags created")
    total_failed: int = Field(..., description="Total number of failed creations")


class TagUsageUpdate(BaseModel):
    """Tag usage update schema."""
    increment: int = Field(1, ge=1, description="Number to increment usage count by")


class WorkflowTagQuery(BaseModel):
    """Workflow tag query schema for future workflow-tag association."""
    workflow_id: str = Field(..., min_length=1, max_length=100, description="Workflow identifier")
    workflow_version: Optional[str] = Field(None, max_length=100, description="Workflow version")
    space_id: str = Field(..., min_length=1, max_length=100, description="Space identifier")
    tag_ids: Optional[List[int]] = Field(None, description="List of tag IDs to associate")


class WorkflowTagResponse(BaseModel):
    """Workflow tag response schema for future workflow-tag association."""
    workflow_id: str = Field(..., description="Workflow identifier")
    workflow_version: Optional[str] = Field(None, description="Workflow version")
    space_id: str = Field(..., description="Space identifier")
    tags: List[TagResponse] = Field(..., description="Associated tags")


# Request/response schemas for API endpoints
class TagCreateRequest(BaseModel):
    """Tag creation request wrapper."""
    tag: TagCreate = Field(..., description="Tag creation data")


class TagUpdateRequest(BaseModel):
    """Tag update request wrapper."""
    tag_data: TagUpdate = Field(..., description="Tag update data")
    query: TagIdQuery = Field(..., description="Tag identification query")


class TagSearchRequest(BaseModel):
    """Tag search request wrapper."""
    query: TagSearchQuery = Field(..., description="Search parameters")


class TagListRequest(BaseModel):
    """Tag list request wrapper."""
    query: TagQuery = Field(..., description="Query parameters")