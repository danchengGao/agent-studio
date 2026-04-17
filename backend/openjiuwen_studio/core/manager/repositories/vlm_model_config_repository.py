from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.core.manager.repositories import BaseRepository
from openjiuwen_studio.models.vlm_model_config import VLMModelConfig
from openjiuwen_studio.schemas.model_config import ModelProvider


@dataclass
class VLMModelConfigQuery:
    space_id: str
    page: int = 1
    size: int = 10
    provider: Optional[ModelProvider] = None
    is_active: Optional[bool] = None
    search: Optional[str] = None
    sort_by: Optional[str] = "updated_at"
    sort_order: Optional[str] = "desc"


class VLMModelConfigRepository(BaseRepository[VLMModelConfig]):
    def __init__(self, db: Session):
        super().__init__(db, VLMModelConfig)

    def get_by_name(self, name: str, space_id: str) -> Optional[VLMModelConfig]:
        return self.query().filter(
            VLMModelConfig.name == name,
            VLMModelConfig.space_id == space_id,
        ).first()

    def get_paginated(
        self,
        query_params: VLMModelConfigQuery,
    ) -> tuple[List[VLMModelConfig], int]:
        query = self.query().filter(VLMModelConfig.space_id == query_params.space_id)

        if query_params.provider:
            query = query.filter(VLMModelConfig.provider == query_params.provider.value)

        if query_params.is_active is not None:
            query = query.filter(VLMModelConfig.is_active == query_params.is_active)

        if query_params.search:
            query = query.filter(
                or_(
                    VLMModelConfig.name.ilike(f"%{query_params.search}%"),
                    VLMModelConfig.model_id.ilike(f"%{query_params.search}%"),
                )
            )

        if query_params.sort_by == "name":
            order_column = VLMModelConfig.name
        elif query_params.sort_by == "created_at":
            order_column = VLMModelConfig.created_at
        else:
            order_column = VLMModelConfig.updated_at

        order_expression = order_column.desc() if query_params.sort_order == "desc" else order_column.asc()
        query = query.order_by(order_expression)

        total = query.count()
        offset = (query_params.page - 1) * query_params.size
        models = query.offset(offset).limit(query_params.size).all()
        return models, total

    def check_name_exists(self, space_id: str, name: str, exclude_id: Optional[int] = None) -> bool:
        query = self.query().filter(
            VLMModelConfig.space_id == space_id,
            VLMModelConfig.name == name,
        )
        if exclude_id:
            query = query.filter(VLMModelConfig.id != exclude_id)
        return query.first() is not None

    def toggle_status(self, config_id: int) -> Optional[VLMModelConfig]:
        model = self.get_by_id(config_id)
        if model:
            model.is_active = not model.is_active
            try:
                self.db.commit()
                self.db.refresh(model)
            except Exception as e:
                logger.error(f"Failed to toggle status for VLM model {config_id}: {e}")
                self.db.rollback()
                raise
        return model
