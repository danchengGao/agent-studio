import os
import time
from typing import Any

from sqlalchemy.orm import Session

from openjiuwen.core.common.logging import logger
from openjiuwen.core.foundation.llm import Model, ModelClientConfig, ModelRequestConfig
from openjiuwen_studio.core.exceptions import (
    ModelApiKeyDecryptError,
    ModelConfigNotFoundError,
    ModelTestError,
)
from openjiuwen_studio.core.manager.model_manager.utils.security_utils import SecurityUtils
from openjiuwen_studio.core.manager.repositories import VLMModelConfigRepository
from openjiuwen_studio.core.utils.compatible_field import compatible_provider
from openjiuwen_studio.schemas.model_config import ModelTestResponse
from openjiuwen_studio.schemas.vlm_model_config import VLMModelTestRequest


class VLMModelTester:
    """VLM connectivity tester."""

    def __init__(self, db: Session):
        self.db = db
        self.model_repo = VLMModelConfigRepository(db)
        self.security_utils = SecurityUtils()

    async def test_model_config(self, model_id: int, test_request: VLMModelTestRequest) -> ModelTestResponse:
        start_time = time.time()

        model = self.model_repo.get_by_id(model_id)
        if not model:
            raise ModelConfigNotFoundError(f"VLM model configuration not found: {model_id}")

        if not model.is_active:
            raise ModelTestError(f"Model {model.name} is currently inactive and cannot be tested")

        api_key = model.api_key
        if api_key:
            try:
                api_key = self.security_utils.decrypt_api_key(api_key)
            except Exception as exc:
                raise ModelApiKeyDecryptError(f"API key decryption failed: {str(exc)}") from exc

        if not api_key:
            raise ModelTestError(f"Model {model.name} lacks a valid API key")

        temperature = 0.7
        top_p = 0.9
        max_tokens = 4096

        if test_request.parameters:
            if test_request.parameters.temperature is not None:
                temperature = test_request.parameters.temperature
            if test_request.parameters.top_p is not None:
                top_p = test_request.parameters.top_p
            if test_request.parameters.max_tokens is not None:
                max_tokens = test_request.parameters.max_tokens

        try:
            model_client_config = ModelClientConfig(
                client_provider=compatible_provider(model.provider),
                api_key=api_key,
                api_base=model.base_url,
                max_retries=model.retry_count or 3,
                timeout=model.timeout or 60,
                verify_ssl=os.getenv("LLM_SSL_VERIFY", "true") == "false",
            )

            model_config = ModelRequestConfig(
                model=model.model_id,
                top_p=top_p,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            model_inference = Model(
                model_client_config=model_client_config,
                model_config=model_config,
            )
            ai_message = await model_inference.invoke(self.build_test_messages(test_request))
            response_time = time.time() - start_time

            return ModelTestResponse(
                success=True,
                response=str(ai_message.content),
                error=None,
                latency=response_time,
                tokens_used=0,
                cost=0.0,
            )
        except Exception as exc:
            logger.error(f"VLM model inference failed: {model.name} (ID: {model_id}), error: {str(exc)}")
            raise ModelTestError(
                f"Model invocation failed, please check model related configuration: {str(exc)}"
            ) from exc

    @staticmethod
    def build_test_messages(test_request: VLMModelTestRequest) -> list[dict[str, Any]]:
        """Build plain-text or multimodal test messages for VLM invocation."""
        has_image_base64 = bool(test_request.image_base64)
        has_mime_type = bool(test_request.mime_type)

        if has_image_base64 != has_mime_type:
            raise ModelTestError("VLM test image must include both mime_type and image_base64")

        if not has_image_base64:
            return [{"role": "user", "content": test_request.prompt}]

        return [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": test_request.prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{test_request.mime_type};base64,{test_request.image_base64}",
                        },
                    },
                ],
            }
        ]
