import logging
import time
from datetime import datetime, timezone
from typing import Optional

from openjiuwen.core.common.exception.exception import JiuWenBaseException
from openjiuwen.core.utils.llm.model_utils.model_factory import ModelFactory
from sqlalchemy.orm import Session

from openjiuwen_studio.core.manager.repositories import ModelConfigRepository, ModelUsageRepository
from openjiuwen_studio.schemas.model_config import ModelTestRequest, ModelTestResponse
from openjiuwen_studio.core.manager.model_manager.utils.security_utils import SecurityUtils
from openjiuwen_studio.core.exceptions import (
    ModelConfigNotFoundError,
    ModelTestError,
    ValidationError, ModelApiKeyDecryptError
)
from openjiuwen_studio.core.common.status_code import StatusCode

logger = logging.getLogger(__name__)


class ModelTester:
    """Model tester.

    Provides model testing business logic including test execution and result recording.
    """

    def __init__(self, db: Session):
        """Initialize model test manager

        Args:
            db: Database session
        """
        self.db = db
        self.model_repo = ModelConfigRepository(db)
        self.usage_repo = ModelUsageRepository(db)
        self.security_utils = SecurityUtils()
        self.model_factory = ModelFactory()

    async def test_model_config(
            self,
            model_id: int,
            test_request: ModelTestRequest,
            user_id: int
    ) -> ModelTestResponse:
        """Test model configuration

        Args:
            model_id: Model ID
            test_request: Test request data
            user_id: Test user ID

        Returns:
            Model test response

        Raises:
            ModelConfigNotFoundError: Model configuration not found
            ModelTestError: Model test failed
            ValidationError: Data validation failed
        """
        start_time = time.time()

        try:
            # Get model configuration
            model = self.model_repo.get_by_id(model_id)
            if not model:
                raise ModelConfigNotFoundError(f"Model configuration not found: {model_id}")

            # Check model status
            if not model.is_active:
                raise ModelTestError(f"Model {model.name} is currently inactive and cannot be tested")

            api_key = model.api_key
            if api_key:
                try:
                    api_key = SecurityUtils().decrypt_api_key(api_key)
                except Exception as e:
                    raise ModelApiKeyDecryptError(f"API key decryption failed: {str(e)}") from e

            # Validate API key
            if not api_key:
                raise ModelTestError(f"Model {model.name} lacks a valid API key")

            # Execute model inference using ModelFactory
            try:
                factory_model = self.model_factory.get_model(
                    model_provider=model.provider,
                    api_key=api_key,
                    api_base=model.base_url,
                    max_retries=3,
                    timeout=model.timeout or 60
                )

                temperature = 0.7
                top_p = 0.9
                if test_request.parameters:
                    if hasattr(test_request.parameters, 'temperature'):
                        temperature = test_request.parameters.temperature
                    if hasattr(test_request.parameters, 'top_p'):
                        top_p = test_request.parameters.top_p

                messages = [
                    {"role": "user", "content": test_request.prompt}
                ]

                ai_message = await factory_model.ainvoke(
                    model_name=model.model_type,
                    messages=messages,
                    temperature=temperature,
                    top_p=top_p
                )

                inference_result = {
                    'response': str(ai_message.content),
                    'tokens_used': 0,  # ModelFactory 不提供此信息
                    'cost': 0.0  # ModelFactory 不提供此信息
                }

                # Calculate response time
                response_time = time.time() - start_time

                # Log successful test result
                self._log_test_result(
                    model_id=model_id,
                    user_id=user_id,
                    prompt=test_request.prompt,
                    response=inference_result.get('response', ''),
                    tokens_used=inference_result.get('tokens_used', 0),
                    cost=inference_result.get('cost', 0.0),
                    response_time=response_time,
                    success=True,
                    error_message=None
                )

                # Update model usage statistics
                self.model_repo.update_usage_stats(
                    model_id=model_id,
                    tokens_used=inference_result.get('tokens_used', 0),
                    cost=inference_result.get('cost', 0.0),
                    response_time=response_time,
                    success=True
                )

                logger.info(
                    f"Model test successful: {model.name} (ID: {model_id}), response time: {response_time:.2f}s")

                return ModelTestResponse(
                    success=True,
                    response=inference_result.get('response', ''),
                    tokens_used=inference_result.get('tokens_used', 0),
                    cost=inference_result.get('cost', 0.0),
                    latency=response_time,
                    error=None
                )

            except Exception as inference_error:
                # Calculate response time
                response_time = time.time() - start_time
                error_message = str(inference_error)

                user_error_msg = self._map_inference_error_to_user_msg(error_message)

                # Log failed test result
                self._log_test_result(
                    model_id=model_id,
                    user_id=user_id,
                    prompt=test_request.prompt,
                    response='',
                    tokens_used=0,
                    cost=0.0,
                    response_time=response_time,
                    success=False,
                    error_message=error_message
                )

                # Update model usage statistics (failure case)
                self.model_repo.update_usage_stats(
                    model_id=model_id,
                    tokens_used=0,
                    cost=0.0,
                    response_time=response_time,
                    success=False
                )

                logger.error(f"Model inference failed: {model.name} (ID: {model_id}), error: {error_message}")

                raise JiuWenBaseException(
                    error_code=StatusCode.AGENT_TEST_FAILED.code,
                    message=StatusCode.AGENT_TEST_FAILED.errmsg.format(msg=user_error_msg)
                ) from inference_error

        except (ModelConfigNotFoundError, ModelTestError, ValidationError):
            raise
        except Exception as e:
            logger.error(f"Model test exception: {str(e)}")
            raise ModelTestError(f"Model test exception: {str(e)}") from e

    def _map_inference_error_to_user_msg(self, error_message: str) -> str:
        msg = error_message.lower()

        if "401" in msg or "unauthorized" in msg or "'bad request" in msg:
            return "API Key 或模型 ID 无效，请检查模型配置"

        if "resolving ip address failed" in msg or "dns" in msg:
            return "模型服务地址不可达，请检查模型基础服务地址或网络配置"

        return "模型调用失败，请检查模型相关配置"

    def _log_test_result(
            self,
            model_id: int,
            user_id: int,
            prompt: str,
            response: str,
            tokens_used: int,
            cost: float,
            response_time: float,
            success: bool,
            error_message: Optional[str] = None
    ) -> None:
        """Log test result
        
        Args:
            model_id: Model ID
            user_id: User ID
            prompt: Input prompt (for logging only, not stored in database)
            response: Model response (for logging only, not stored in database)
            tokens_used: Number of tokens used
            cost: Cost
            response_time: Response time
            success: Whether successful
            error_message: Error message (optional)
        """
        try:
            # ModelUsageLog model has no prompt and response fields, only records token statistics
            log_data = {
                'model_config_id': model_id,
                'total_tokens': tokens_used,  # Use correct field name
                'cost': cost,
                'response_time': response_time,
                'success': success,
                'error_message': error_message,
                'created_at': datetime.now(timezone.utc).replace(tzinfo=None)
            }

            self.usage_repo.create(log_data)

        except Exception as e:
            logger.error(f"Failed to log test result: {type(e).__name__}")
