import asyncio
import json
import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, Optional, Tuple, Type

import httpx
from sqlalchemy.orm import Session

from app.models.model_config import ModelConfig
from app.schemas.model_config import ModelProvider

logger = logging.getLogger(__name__)


class ModelTestMetrics:
    """Data class for model test metrics."""
    
    def __init__(self, latency: float = 0.0, tokens_used: int = 0, 
                 prompt_tokens: int = 0, completion_tokens: int = 0, cost: float = 0.0):
        self.latency = latency
        self.tokens_used = tokens_used
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.cost = cost
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary."""
        return {
            "latency": self.latency,
            "tokens_used": self.tokens_used,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "cost": self.cost
        }


class BaseModelProvider(ABC):
    """Abstract base class for model providers.
    
    This class defines the common interface and shared functionality
    for all model providers.
    """
    
    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.default_params = self._get_default_params()
    
    @abstractmethod
    def _get_default_params(self) -> Dict[str, Any]:
        """Get default parameters for this provider."""
        pass
    
    @abstractmethod
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        """Build request headers for this provider."""
        pass
    
    @abstractmethod
    def _build_payload(self, model: ModelConfig, prompt: str, 
                      parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Build request payload for this provider."""
        pass
    
    @abstractmethod
    def _get_endpoint_url(self, model: ModelConfig) -> str:
        """Get the API endpoint URL for this provider."""
        pass
    
    @abstractmethod
    def _extract_response_content(self, response_data: Dict[str, Any]) -> str:
        """Extract content from API response."""
        pass
    
    @abstractmethod
    def _extract_usage_metrics(self, response_data: Dict[str, Any]) -> Tuple[int, int, int]:
        """Extract usage metrics from response.
        
        Returns:
            Tuple[int, int, int]: (prompt_tokens, completion_tokens, total_tokens)
        """
        pass
    
    @abstractmethod
    def _calculate_cost(self, model_type: str, prompt_tokens: int, 
                      completion_tokens: int) -> float:
        """Calculate cost based on token usage."""
        pass
    
    def _merge_parameters(self, model: ModelConfig, 
                         parameters: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge default, model, and provided parameters."""
        merged = self.default_params.copy()
        
        # Add parameters from model configuration
        if hasattr(model, 'parameters') and model.parameters:
            if isinstance(model.parameters, str):
                try:
                    model_params = json.loads(model.parameters)
                    merged.update(model_params)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON in model parameters: {model.parameters}")
            elif isinstance(model.parameters, dict):
                merged.update(model.parameters)
        
        # Add provided parameters (highest priority)
        if parameters:
            merged.update(parameters)
        
        return merged
    
    async def invoke(self, model: ModelConfig, api_key: str, 
                    prompt: str = "Hello, this is a test message.",
                    parameters: Optional[Dict[str, Any]] = None) -> Tuple[bool, str, Dict[str, Any]]:
        """Invoke a one-time call to the model for inference or testing.
        
        This is the main method that orchestrates the model execution.
        It can be used for:
        - Connectivity testing
        - Prompt debugging
        - One-off generation
        - Pre-flight checks
        
        Returns:
            Tuple of (success: bool, output_or_error: str, metadata: dict)
        """
        start_time = datetime.now()
        
        try:
            # Merge parameters
            merged_params = self._merge_parameters(model, parameters)
            
            # Build request
            headers = self._build_headers(api_key)
            payload = self._build_payload(model, prompt, merged_params)
            url = self._get_endpoint_url(model)
            
            # Send request
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                # Calculate latency
                latency = (datetime.now() - start_time).total_seconds()
                
                if response.status_code == 200:
                    response_data = response.json()
                    content = self._extract_response_content(response_data)
                    
                    # Extract usage metrics
                    prompt_tokens, completion_tokens, total_tokens = self._extract_usage_metrics(response_data)
                    cost = self._calculate_cost(model.model_type, prompt_tokens, completion_tokens)
                    
                    metrics = ModelTestMetrics(
                        latency=latency,
                        tokens_used=total_tokens,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        cost=cost
                    )
                    
                    return True, content, metrics.to_dict()
                else:
                    error_msg = f"API request failed with status {response.status_code}: {response.text}"
                    logger.error(error_msg)
                    return False, error_msg, ModelTestMetrics(latency=latency).to_dict()
                    
        except httpx.TimeoutException:
            error_msg = f"Request timeout after {self.timeout} seconds"
            logger.error(error_msg)
            return False, error_msg, ModelTestMetrics().to_dict()
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return False, error_msg, ModelTestMetrics().to_dict()


class OpenAIProvider(BaseModelProvider):
    """OpenAI model provider"""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            "temperature": 0.7,
            "max_tokens": 1000,
            "top_p": 1.0,
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0
        }
    
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def _build_payload(self, model: ModelConfig, prompt: str, 
                      parameters: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "model": model.model_type,
            "messages": [{"role": "user", "content": prompt}],
            **parameters
        }
    
    def _get_endpoint_url(self, model: ModelConfig) -> str:
        base_url = model.base_url
        return f"{base_url.rstrip('/')}/chat/completions"
    
    def _extract_response_content(self, response_data: Dict[str, Any]) -> str:
        return response_data["choices"][0]["message"]["content"]
    
    def _extract_usage_metrics(self, response_data: Dict[str, Any]) -> Tuple[int, int, int]:
        usage = response_data.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
        return prompt_tokens, completion_tokens, total_tokens
    
    def _calculate_cost(self, model_type: str, prompt_tokens: int, 
                      completion_tokens: int) -> float:
        # OpenAI pricing (example)
        pricing = {
            "gpt-4": {"input": 0.03, "output": 0.06},  # per 1K tokens
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "gpt-3.5-turbo": {"input": 0.001, "output": 0.002}
        }
        
        model_pricing = pricing.get(model_type, {"input": 0.001, "output": 0.002})
        input_cost = (prompt_tokens / 1000) * model_pricing["input"]
        output_cost = (completion_tokens / 1000) * model_pricing["output"]
        return input_cost + output_cost


class AnthropicProvider(BaseModelProvider):
    """Anthropic model provider"""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            "max_tokens": 1000,
            "temperature": 0.7
        }
    
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        return {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
    
    def _build_payload(self, model: ModelConfig, prompt: str, 
                      parameters: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "model": model.model_type,
            "messages": [{"role": "user", "content": prompt}],
            **parameters
        }
    
    def _get_endpoint_url(self, model: ModelConfig) -> str:
        base_url = model.base_url
        return f"{base_url.rstrip('/')}/v1/messages"
    
    def _extract_response_content(self, response_data: Dict[str, Any]) -> str:
        return response_data["content"][0]["text"]
    
    def _extract_usage_metrics(self, response_data: Dict[str, Any]) -> Tuple[int, int, int]:
        usage = response_data.get("usage", {})
        prompt_tokens = usage.get("input_tokens", 0)
        completion_tokens = usage.get("output_tokens", 0)
        total_tokens = prompt_tokens + completion_tokens
        return prompt_tokens, completion_tokens, total_tokens
    
    def _calculate_cost(self, model_type: str, prompt_tokens: int, 
                      completion_tokens: int) -> float:
        # Anthropic pricing (example)
        pricing = {
            "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
            "claude-3-sonnet-20240229": {"input": 0.003, "output": 0.015},
            "claude-3-haiku-20240307": {"input": 0.00025, "output": 0.00125}
        }
        
        model_pricing = pricing.get(model_type, {"input": 0.003, "output": 0.015})
        input_cost = (prompt_tokens / 1000) * model_pricing["input"]
        output_cost = (completion_tokens / 1000) * model_pricing["output"]
        return input_cost + output_cost


class DeepSeekProvider(BaseModelProvider):
    """DeepSeek model provider implementation (OpenAI-compatible)."""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            "temperature": 0.7,
            "max_tokens": 150,
            "top_p": 1.0
        }
    
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def _build_payload(self, model: ModelConfig, prompt: str, 
                      parameters: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "model": model.model_type,
            "messages": [{"role": "user", "content": prompt}],
            **parameters
        }
    
    def _get_endpoint_url(self, model: ModelConfig) -> str:
        base_url = model.base_url
        return f"{base_url.rstrip('/')}/chat/completions"
    
    def _extract_response_content(self, response_data: Dict[str, Any]) -> str:
        return response_data["choices"][0]["message"]["content"]
    
    def _extract_usage_metrics(self, response_data: Dict[str, Any]) -> Tuple[int, int, int]:
        usage = response_data.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
        return prompt_tokens, completion_tokens, total_tokens
    
    def _calculate_cost(self, model_type: str, prompt_tokens: int, 
                      completion_tokens: int) -> float:
        # DeepSeek pricing (very competitive)
        total_tokens = prompt_tokens + completion_tokens
        return (total_tokens / 1000) * 0.0001


class QwenProvider(BaseModelProvider):
    """Qwen model provider implementation."""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            "temperature": 0.7,
            "max_tokens": 150,
            "top_p": 1.0
        }
    
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def _build_payload(self, model: ModelConfig, prompt: str, 
                      parameters: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "model": model.model_type,
            "input": {
                "messages": [{"role": "user", "content": prompt}]
            },
            "parameters": parameters
        }
    
    def _get_endpoint_url(self, model: ModelConfig) -> str:
        base_url = model.base_url
        return f"{base_url.rstrip('/')}/api/v1/services/aigc/text-generation/generation"
    
    def _extract_response_content(self, response_data: Dict[str, Any]) -> str:
        return response_data["output"]["text"]
    
    def _extract_usage_metrics(self, response_data: Dict[str, Any]) -> Tuple[int, int, int]:
        usage = response_data.get("usage", {})
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        total_tokens = usage.get("total_tokens", input_tokens + output_tokens)
        return input_tokens, output_tokens, total_tokens
    
    def _calculate_cost(self, model_type: str, prompt_tokens: int, 
                      completion_tokens: int) -> float:
        # Qwen pricing
        total_tokens = prompt_tokens + completion_tokens
        return (total_tokens / 1000) * 0.0005


class CustomProvider(BaseModelProvider):
    """Custom model provider implementation (OpenAI-compatible)."""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            "temperature": 0.7,
            "max_tokens": 150,
            "top_p": 1.0
        }
    
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if api_key:  # API key is optional for custom models
            headers["Authorization"] = f"Bearer {api_key}"
        return headers
    
    def _build_payload(self, model: ModelConfig, prompt: str, 
                      parameters: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "model": model.model_type,
            "messages": [{"role": "user", "content": prompt}],
            **parameters
        }
    
    def _get_endpoint_url(self, model: ModelConfig) -> str:
        return model.base_url
    
    def _extract_response_content(self, response_data: Dict[str, Any]) -> str:
        return response_data["choices"][0]["message"]["content"]
    
    def _extract_usage_metrics(self, response_data: Dict[str, Any]) -> Tuple[int, int, int]:
        usage = response_data.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
        return prompt_tokens, completion_tokens, total_tokens
    
    def _calculate_cost(self, model_type: str, prompt_tokens: int, 
                      completion_tokens: int) -> float:
        # Default cost calculation for custom models
        total_tokens = prompt_tokens + completion_tokens
        return (total_tokens / 1000) * 0.001


class SiliconFlowProvider(BaseModelProvider):
    """SiliconFlow model provider implementation (OpenAI-compatible)."""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            "temperature": 0.7,
            "max_tokens": 150,
            "top_p": 1.0,
            "stream": False
        }
    
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def _build_payload(self, model: ModelConfig, prompt: str, 
                      parameters: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "model": model.model_type,
            "messages": [{"role": "user", "content": prompt}],
            **parameters
        }
    
    def _get_endpoint_url(self, model: ModelConfig) -> str:
        base_url = model.base_url
        return f"{base_url}/chat/completions"
    
    def _extract_response_content(self, response_data: Dict[str, Any]) -> str:
        return response_data["choices"][0]["message"]["content"]
    
    def _extract_usage_metrics(self, response_data: Dict[str, Any]) -> Tuple[int, int, int]:
        usage = response_data.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
        return prompt_tokens, completion_tokens, total_tokens
    
    def _calculate_cost(self, model_type: str, prompt_tokens: int, 
                      completion_tokens: int) -> float:
        # SiliconFlow pricing (competitive rates)
        total_tokens = prompt_tokens + completion_tokens
        # Different models have different pricing
        if "qwen" in model_type.lower():
            return (total_tokens / 1000) * 0.0007
        elif "llama" in model_type.lower():
            return (total_tokens / 1000) * 0.0005
        else:
            return (total_tokens / 1000) * 0.001


class ZhipuProvider(BaseModelProvider):
    """Zhipu AI (智谱AI) model provider implementation."""
    
    def _get_default_params(self) -> Dict[str, Any]:
        return {
            "temperature": 0.7,
            "max_tokens": 150,
            "top_p": 1.0,
            "stream": False
        }
    
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def _build_payload(self, model: ModelConfig, prompt: str, 
                      parameters: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "model": model.model_type,
            "messages": [{"role": "user", "content": prompt}],
            **parameters
        }
    
    def _get_endpoint_url(self, model: ModelConfig) -> str:
        base_url = model.base_url
        return f"{base_url}/chat/completions"

    def _extract_response_content(self, response_data: Dict[str, Any]) -> str:
        return response_data["choices"][0]["message"]["content"]
    
    def _extract_usage_metrics(self, response_data: Dict[str, Any]) -> Tuple[int, int, int]:
        usage = response_data.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
        return prompt_tokens, completion_tokens, total_tokens
    
    def _calculate_cost(self, model_type: str, prompt_tokens: int, 
                      completion_tokens: int) -> float:
        # Zhipu AI pricing
        if "glm-4" in model_type.lower():
            # GLM-4 pricing: input ¥0.1/1K tokens, output ¥0.3/1K tokens
            return (prompt_tokens / 1000) * 0.1 + (completion_tokens / 1000) * 0.3
        elif "glm-3" in model_type.lower():
            # GLM-3 pricing: input ¥0.05/1K tokens, output ¥0.15/1K tokens
            return (prompt_tokens / 1000) * 0.05 + (completion_tokens / 1000) * 0.15
        else:
            # Default pricing
            return (prompt_tokens / 1000) * 0.05 + (completion_tokens / 1000) * 0.15


class ModelProviderFactory:
    """Model provider factory class"""
    
    _providers = {
        ModelProvider.OPENAI: OpenAIProvider,
        ModelProvider.ANTHROPIC: AnthropicProvider,
        ModelProvider.DEEPSEEK.value: DeepSeekProvider,
        ModelProvider.QWEN.value: QwenProvider,
        ModelProvider.SILICONFLOW.value: SiliconFlowProvider,
        ModelProvider.ZHIPU.value: ZhipuProvider,
        ModelProvider.CUSTOM.value: CustomProvider,
    }
    
    @classmethod
    def get_provider(cls, provider: ModelProvider, timeout: int = 30) -> BaseModelProvider:
        """Get specified model provider instance"""
        if provider not in cls._providers:
            raise ValueError(f"Unsupported provider: {provider}")
        
        return cls._providers[provider](timeout=timeout)
    
    @classmethod
    def get_supported_providers(cls) -> list[str]:
        """Get list of supported providers"""
        return [provider.value for provider in cls._providers.keys()]
    
    @classmethod
    def register_provider(cls, provider_name: str, provider_class: Type[BaseModelProvider]) -> None:
        """Register custom provider"""
        # Convert string to ModelProvider enum (if needed)
        cls._providers[provider_name] = provider_class


class ModelProviderManager:
    """Model provider manager.
    
    Manages inference requests for different model providers, including parameter validation,
    request sending, and response processing.
    """
    
    def __init__(self, timeout: int = 30):
        """Initialize model inference manager
        
        Args:
            timeout: Request timeout in seconds
        """
        self.timeout = timeout
    
    async def test_model_connection(
        self,
        model: ModelConfig,
        api_key: str,
        prompt: str = "Hello, this is a test message.",
        parameters: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """Test model connection and return success status, response and metrics
        
        Args:
            model: Model configuration object containing provider details
            api_key: API key for authentication
            prompt: Test prompt to send
            parameters: Additional model parameters
            
        Returns:
            Tuple[bool, str, Dict[str, Any]]: (success status, response/error message, metrics)
        """
        logger.info(f"Testing model connection for {model.provider} - {model.model_type}")
        
        try:
            provider = ModelProviderFactory.get_provider(model.provider, self.timeout)
            return await provider.invoke(model, api_key, prompt, parameters)
            
        except ValueError as e:
            # Unsupported provider
            logger.error(f"Unsupported provider {model.provider}: {str(e)}")
            return False, str(e), ModelTestMetrics().to_dict()
        except Exception as e:
            # Unexpected error
            logger.error(f"Model test failed for {model.provider}: {str(e)}")
            return False, str(e), ModelTestMetrics().to_dict()

    @staticmethod
    def get_supported_providers() -> list[str]:
        """Get list of supported provider names

        Returns:
            list[str]: List of supported provider names
        """
        return ModelProviderFactory.get_supported_providers()
    
    @staticmethod
    def register_custom_provider(provider_name: str, provider_class: Type[BaseModelProvider]) -> None:
        """Register custom provider

        Args:
            provider_name: Provider name
            provider_class: Provider class inheriting from BaseModelProvider
        """
        ModelProviderFactory.register_provider(provider_name, provider_class)