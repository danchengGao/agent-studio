from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.core.database import get_db
from openjiuwen_studio.core.exceptions import (
    ModelApiKeyDecryptError,
    ModelConfigNotFoundError,
    ModelTestError,
)
from openjiuwen_studio.core.manager.model_manager.managers.vlm_model_config_manager import (
    VLMModelConfigManager,
    VLMModelConfigQuery,
)
from openjiuwen_studio.core.manager.model_manager.managers.vlm_model_test_manager import (
    VLMModelTester,
)
from openjiuwen_studio.routers.auth import get_current_user
from openjiuwen_studio.schemas.common import ResponseModel
from openjiuwen_studio.schemas.model_config import (
    ModelProvider,
    ModelTestResponse,
)
from openjiuwen_studio.schemas.vlm_model_config import (
    VLMModelConfigCreate,
    VLMModelConfigList,
    VLMModelConfigRequest,
    VLMModelConfigResponse,
    VLMModelTestRequest,
    VLMModelConfigUpdate,
    VLMModelConfigUpdateRequest,
)

vlm_models_router = APIRouter(prefix="/vlm-models", tags=["vlm-models"])


class VLMModelConfigQueryParams(BaseModel):
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(10, ge=1, le=100, description="Page size")
    provider: Optional[ModelProvider] = Field(None, description="Filter by provider")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    search: Optional[str] = Field(None, description="Search in name and model_id")
    sort_by: Optional[str] = Field("updated_at", description="Sort by field")
    sort_order: Optional[str] = Field("desc", description="Sort order")


def get_vlm_model_config_manager(db: Session = Depends(get_db)) -> VLMModelConfigManager:
    return VLMModelConfigManager(db)


def get_vlm_model_tester(db: Session = Depends(get_db)) -> VLMModelTester:
    return VLMModelTester(db)


@vlm_models_router.get("/{space_id}", response_model=ResponseModel[VLMModelConfigList])
async def get_vlm_model_configs(
    space_id: str,
    query_params: VLMModelConfigQueryParams = Depends(),
    manager: VLMModelConfigManager = Depends(get_vlm_model_config_manager),
    current_user: dict = Depends(get_current_user),
):
    try:
        models, total = manager.get_paginated_configs(
            VLMModelConfigQuery(
                space_id=space_id,
                page=query_params.page,
                size=query_params.size,
                provider=query_params.provider,
                is_active=query_params.is_active,
                search=query_params.search,
                sort_by=query_params.sort_by,
                sort_order=query_params.sort_order,
            )
        )
        result = VLMModelConfigList(
            items=[manager.model_to_response(model) for model in models],
            total=total,
            page=query_params.page,
            size=query_params.size,
        )
        return ResponseModel(code=200, message="VLM model configurations retrieved successfully", data=result)
    except Exception as e:
        logger.error(f"Error retrieving VLM model configs: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@vlm_models_router.get("/", response_model=ResponseModel[VLMModelConfigResponse])
async def get_vlm_model_config(
    config_id: int = Query(..., description="Configuration ID"),
    space_id: str = Query(..., description="Space ID"),
    manager: VLMModelConfigManager = Depends(get_vlm_model_config_manager),
    current_user: dict = Depends(get_current_user),
):
    try:
        model = manager.get_config_by_id(config_id, space_id)
        return ResponseModel(
            code=200,
            message="VLM model configuration retrieved successfully",
            data=manager.model_to_response(model),
        )
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="VLM model configuration not found",
            ) from e
        logger.error(f"Error retrieving VLM model config: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@vlm_models_router.post("/{config_id}/test", response_model=ResponseModel[ModelTestResponse])
async def test_vlm_model_config(
    config_id: int,
    test_request: VLMModelTestRequest,
    tester: VLMModelTester = Depends(get_vlm_model_tester),
    current_user: dict = Depends(get_current_user),
):
    try:
        test_result = await tester.test_model_config(model_id=config_id, test_request=test_request)
        if test_result.success:
            return ResponseModel(
                code=200,
                message="VLM model test completed successfully",
                data=test_result,
            )

        return ResponseModel(
            code=400,
            message=f"VLM model test failed: {test_result.error or 'Unknown error'}",
            data=test_result,
        )
    except ModelConfigNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VLM model configuration not found",
        ) from exc
    except (ModelTestError, ModelApiKeyDecryptError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error(f"Error testing VLM model config: {str(exc)}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@vlm_models_router.post("/", response_model=ResponseModel[VLMModelConfigResponse])
async def create_vlm_model_config(
    model_config: VLMModelConfigCreate,
    manager: VLMModelConfigManager = Depends(get_vlm_model_config_manager),
    current_user: dict = Depends(get_current_user),
):
    try:
        db_model = manager.create_config(model_config)
        return ResponseModel(
            code=200,
            message="VLM model configuration created successfully",
            data=manager.model_to_response(db_model),
        )
    except Exception as e:
        if "already exists" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="VLM model configuration with this name already exists",
            ) from e
        logger.error(f"Error creating VLM model config: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@vlm_models_router.post("/update", response_model=ResponseModel[VLMModelConfigResponse])
async def update_vlm_model_config(
    request: VLMModelConfigUpdateRequest,
    manager: VLMModelConfigManager = Depends(get_vlm_model_config_manager),
    current_user: dict = Depends(get_current_user),
):
    try:
        update_data = request.model_dump(exclude={"config_id", "space_id"}, exclude_unset=True)
        model_update = VLMModelConfigUpdate(**update_data)
        model = manager.update_config(request.config_id, request.space_id, model_update)
        return ResponseModel(
            code=200,
            message="VLM model configuration updated successfully",
            data=manager.model_to_response(model),
        )
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="VLM model configuration not found",
            ) from e
        if "already exists" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="VLM model configuration with this name already exists",
            ) from e
        logger.error(f"Error updating VLM model config: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@vlm_models_router.delete("/", response_model=ResponseModel[dict])
async def delete_vlm_model_config(
    model_request: VLMModelConfigRequest,
    manager: VLMModelConfigManager = Depends(get_vlm_model_config_manager),
    current_user: dict = Depends(get_current_user),
):
    try:
        manager.delete_config(model_request.config_id, model_request.space_id)
        return ResponseModel(
            code=200,
            message="VLM model configuration deleted successfully",
            data={"deleted_id": model_request.config_id},
        )
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="VLM model configuration not found",
            ) from e
        logger.error(f"Error deleting VLM model config: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@vlm_models_router.post("/toggle", response_model=ResponseModel[VLMModelConfigResponse])
async def toggle_vlm_model_status(
    request: VLMModelConfigRequest,
    manager: VLMModelConfigManager = Depends(get_vlm_model_config_manager),
    current_user: dict = Depends(get_current_user),
):
    try:
        updated_model = manager.toggle_status(request.config_id, request.space_id)
        return ResponseModel(
            code=200,
            message=f"VLM model {'activated' if updated_model.is_active else 'deactivated'} successfully",
            data=manager.model_to_response(updated_model),
        )
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="VLM model configuration not found",
            ) from e
        logger.error(f"Error toggling VLM model status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
