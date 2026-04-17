from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.core.exceptions import (
    ModelConfigNameExistsError,
    ModelConfigNotFoundError,
    ValidationError,
)
from openjiuwen_studio.core.manager.model_manager.utils import SecurityUtils
from openjiuwen_studio.core.manager.repositories import VLMModelConfigRepository
from openjiuwen_studio.core.manager.repositories.vlm_model_config_repository import VLMModelConfigQuery
from openjiuwen_studio.models.vlm_model_config import VLMModelConfig
from openjiuwen_studio.schemas.vlm_model_config import (
    VLMModelConfigCreate,
    VLMModelConfigResponse,
    VLMModelConfigUpdate,
)


class VLMModelConfigManager:
    def __init__(self, db: Session):
        self.db = db
        self.repo = VLMModelConfigRepository(db)
        self.security_utils = SecurityUtils()

    def get_paginated_configs(
        self,
        query: VLMModelConfigQuery,
    ) -> Tuple[List[VLMModelConfig], int]:
        try:
            models, total = self.repo.get_paginated(query)
            logger.info(f"Retrieved VLM model configs: page={query.page}, size={query.size}, total={total}")
            return models, total
        except Exception as e:
            logger.error(f"Failed to get VLM model configs: {str(e)}")
            raise ValidationError(f"Failed to get VLM model configs: {str(e)}") from e

    def get_config_by_id(self, config_id: int, space_id: str) -> VLMModelConfig:
        model = self.repo.get_by_id(config_id)
        if not model or model.space_id != space_id:
            raise ModelConfigNotFoundError(f"VLM model config not found: {config_id}")
        return model

    def create_config(self, config_data: VLMModelConfigCreate) -> VLMModelConfig:
        if self.repo.check_name_exists(config_data.space_id, config_data.name):
            raise ModelConfigNameExistsError(f"VLM model config name already exists: {config_data.name}")

        try:
            encrypted_api_key = (
                self.security_utils.encrypt_api_key(config_data.api_key) if config_data.api_key else None
            )
            config_dict = config_data.model_dump(exclude={"api_key"})
            config_dict["api_key"] = encrypted_api_key
            model = self.repo.create(config_dict)
            logger.info(f"Created VLM model config: {model.name} (ID: {model.id})")
            return model
        except Exception as e:
            logger.error(f"Failed to create VLM model config: {str(e)}")
            self.db.rollback()
            raise ValidationError(f"Failed to create VLM model config: {str(e)}") from e

    def update_config(self, config_id: int, space_id: str, config_data: VLMModelConfigUpdate) -> VLMModelConfig:
        model = self.get_config_by_id(config_id, space_id)

        if config_data.name and config_data.name != model.name:
            if self.repo.check_name_exists(space_id, config_data.name, exclude_id=config_id):
                raise ModelConfigNameExistsError(f"VLM model config name already exists: {config_data.name}")

        try:
            update_dict = config_data.model_dump(exclude_unset=True, exclude={"api_key"})
            update_dict["updated_at"] = datetime.now(timezone.utc).replace(tzinfo=None)

            if config_data.api_key is not None:
                update_dict["api_key"] = (
                    self.security_utils.encrypt_api_key(config_data.api_key) if config_data.api_key else None
                )

            updated_model = self.repo.update(model, update_dict)
            logger.info(f"Updated VLM model config: {updated_model.name} (ID: {config_id})")
            return updated_model
        except Exception as e:
            logger.error(f"Failed to update VLM model config: {str(e)}")
            self.db.rollback()
            raise ValidationError(f"Failed to update VLM model config: {str(e)}") from e

    def delete_config(self, config_id: int, space_id: str) -> bool:
        self.get_config_by_id(config_id, space_id)

        try:
            return self.repo.delete(config_id)
        except Exception as e:
            logger.error(f"Failed to delete VLM model config: {str(e)}")
            self.db.rollback()
            raise ValidationError(f"Failed to delete VLM model config: {str(e)}") from e

    def toggle_status(self, config_id: int, space_id: str) -> VLMModelConfig:
        self.get_config_by_id(config_id, space_id)

        try:
            updated_model = self.repo.toggle_status(config_id)
            if updated_model:
                logger.info(
                    f"Toggled VLM model status: {updated_model.name} "
                    f"(ID: {config_id}) -> {'activated' if updated_model.is_active else 'deactivated'}"
                )
            return updated_model
        except Exception as e:
            logger.error(f"Failed to toggle VLM model status: {str(e)}")
            self.db.rollback()
            raise ValidationError(f"Failed to toggle VLM model status: {str(e)}") from e

    def model_to_response(self, model: VLMModelConfig) -> VLMModelConfigResponse:
        masked_api_key = None
        if model.api_key:
            try:
                decrypted_key = self.security_utils.decrypt_api_key(model.api_key)
                masked_api_key = self.security_utils.mask_api_key(decrypted_key)
            except Exception:
                masked_api_key = "***invalid***"

        return VLMModelConfigResponse(
            id=model.id,
            name=model.name,
            provider=model.provider,
            space_id=model.space_id,
            model_id=model.model_id,
            base_url=model.base_url,
            description=model.description,
            tags=model.tags or [],
            timeout=model.timeout,
            retry_count=model.retry_count,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
            api_key_masked=masked_api_key,
        )
