from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from openjiuwen_studio.schemas.model_config import ModelParameters, ModelProvider


class VLMModelConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="VLM configuration name")
    provider: ModelProvider = Field(..., description="VLM provider")
    space_id: str = Field(..., description="Space ID")
    model_id: str = Field(..., min_length=1, max_length=100, description="Provider model identifier")
    base_url: str = Field(..., description="VLM endpoint base URL")
    description: Optional[str] = Field(None, max_length=500, description="VLM description")
    tags: List[str] = Field(default_factory=list, description="VLM tags")
    timeout: int = Field(default=60, ge=1, le=300, description="Request timeout in seconds")
    retry_count: int = Field(default=3, ge=0, le=10, description="Retry attempts")
    is_active: bool = Field(default=True, description="Whether the configuration is active")

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v):
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Base URL must start with http:// or https://")
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 10:
            raise ValueError("Maximum 10 tags allowed")
        return [tag.strip() for tag in v if tag.strip()]


class VLMModelConfigCreate(VLMModelConfigBase):
    api_key: str = Field(..., min_length=1, description="API key for the VLM provider")


class VLMModelConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    provider: Optional[ModelProvider] = Field(None)
    model_id: Optional[str] = Field(None, min_length=1, max_length=100)
    api_key: Optional[str] = Field(None, description="API key for the VLM provider")
    base_url: Optional[str] = Field(None)
    description: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = Field(None)
    timeout: Optional[int] = Field(None, ge=1, le=300)
    retry_count: Optional[int] = Field(None, ge=0, le=10)
    is_active: Optional[bool] = Field(None)

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v):
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Base URL must start with http:// or https://")
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if v and len(v) > 10:
            raise ValueError("Maximum 10 tags allowed")
        return [tag.strip() for tag in v if tag.strip()] if v else v


class VLMModelConfigResponse(VLMModelConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime
    api_key_masked: Optional[str] = Field(None, description="Masked API key for display")

    class Config:
        from_attributes = True


class VLMModelConfigList(BaseModel):
    items: list[VLMModelConfigResponse]
    total: int
    page: int
    size: int


class VLMModelConfigRequest(BaseModel):
    config_id: int
    space_id: str


class VLMModelConfigUpdateRequest(BaseModel):
    config_id: int = Field(..., description="Configuration ID")
    space_id: str = Field(..., description="Space ID")
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    provider: Optional[ModelProvider] = Field(None)
    model_id: Optional[str] = Field(None, min_length=1, max_length=100)
    api_key: Optional[str] = Field(None, description="API key for the VLM provider")
    base_url: Optional[str] = Field(None)
    description: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = Field(None)
    timeout: Optional[int] = Field(None, ge=1, le=300)
    retry_count: Optional[int] = Field(None, ge=0, le=10)
    is_active: Optional[bool] = Field(None)

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v):
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Base URL must start with http:// or https://")
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if v and len(v) > 10:
            raise ValueError("Maximum 10 tags allowed")
        return [tag.strip() for tag in v if tag.strip()] if v else v


class VLMModelTestRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000, description="Test prompt")
    mime_type: Optional[str] = Field(None, min_length=1, max_length=100, description="Image MIME type")
    image_base64: Optional[str] = Field(None, min_length=1, description="Base64-encoded test image")
    parameters: Optional[ModelParameters] = Field(None, description="Override parameters for test")
