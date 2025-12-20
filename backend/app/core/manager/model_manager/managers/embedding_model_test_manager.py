from typing import Optional, Dict, Any
import time
import logging
import requests

from sqlalchemy.orm import Session

from app.core.manager.repositories import EmbeddingModelConfigRepository
from app.schemas.embedding_model_config import EmbeddingModelTestRequest
from app.core.manager.model_manager.utils.security_utils import SecurityUtils
from app.core.exceptions import (
    ModelConfigNotFoundError,
    ModelTestError,
    ValidationError
)

logger = logging.getLogger(__name__)


class EmbeddingModelTester:
    """Embedding 模型测试器 - 直接返回 API 原始响应"""
    
    def __init__(self, db: Session):
        self.db = db
        self.repo = EmbeddingModelConfigRepository(db)
        self.security_utils = SecurityUtils()
    
    async def test_embedding_model(
        self,
        model_id: int,
        test_request: EmbeddingModelTestRequest,
        user_id: int
    ) -> Dict[str, Any]:
        """测试 embedding 模型配置
        
        Args:
            model_id: 模型配置ID
            test_request: 测试请求数据
            user_id: 测试用户ID
            
        Returns:
            Embedding 模型测试响应
            
        Raises:
            ModelConfigNotFoundError: 模型配置不存在
            ModelTestError: 模型测试失败
            ValidationError: 数据验证失败
        """
        start_time = time.time()
        
        try:
            # 获取模型配置
            model = self.repo.get_by_id(model_id)
            if not model:
                raise ModelConfigNotFoundError(f"Embedding model configuration not found: {model_id}")
            
            # 检查模型状态
            if not model.is_active:
                raise ModelTestError(f"Embedding model {model.model_name} is currently inactive and cannot be tested")
            
            # 解密 API key
            api_key = ""
            if model.api_key:
                try:
                    api_key = self.security_utils.decrypt_api_key(model.api_key)
                except Exception as e:
                    raise ModelTestError(f"API key decryption failed: {str(e)}") from e
            
            # 验证 API key
            if not api_key:
                raise ModelTestError(f"Embedding model {model.model_name} lacks a valid API key")
            
            # 直接调用 embedding API，返回原始响应
            try:
                headers = {
                    "Content-Type": "application/json",
                }
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                
                # 构建请求 payload
                payload = {
                    "model": model.model_id,
                    "input": test_request.texts if test_request.texts else test_request.text,
                }
                
                # 发送请求
                resp = requests.post(
                    model.api_base,
                    headers=headers,
                    json=payload,
                    timeout=60
                )
                resp.raise_for_status()
                api_response = resp.json()
                
                response_time = time.time() - start_time
                
                logger.info(
                    f"Embedding model test successful: {model.model_name} (ID: {model_id}), "
                    f"response time: {response_time:.2f}s"
                )
                
                # 直接返回 API 的原始响应
                return api_response
                    
            except requests.exceptions.RequestException as api_error:
                response_time = time.time() - start_time
                error_message = str(api_error)
                
                logger.error(
                    f"Embedding model API call failed: {model.model_name} (ID: {model_id}), "
                    f"error: {error_message}"
                )
                
                # 返回错误信息
                return {
                    "error": error_message,
                    "status_code": (
                        getattr(api_error.response, 'status_code', None)
                        if hasattr(api_error, 'response')
                        else None
                    )
                }
                
        except (ModelConfigNotFoundError, ModelTestError):
            raise
        except Exception as e:
            logger.error(f"Failed to test embedding model {model_id}: {str(e)}", exc_info=True)
            raise ValidationError(f"Failed to test embedding model: {str(e)}") from e

