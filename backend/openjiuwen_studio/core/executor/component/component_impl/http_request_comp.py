#!/usr/bin/python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved

import json
import re
import traceback
from typing import Any, Callable, Dict, List, Union

from openjiuwen.core.workflow import BranchRouter, WorkflowComponent, Input, Output
from openjiuwen.core.workflow.components.condition.condition import Condition
from openjiuwen.core.graph.base import Graph
from openjiuwen.core.session import BaseSession
from openjiuwen.core.context_engine import ModelContext
from openjiuwen.core.session.node import Session

# Import agent-core's HTTPRequestComponent
from openjiuwen.core.workflow import (
    HTTPRequestComponent as CoreHTTPRequestComponent,
    HttpComponentConfig as CoreHttpComponentConfig,
    HttpRequestParamConfig as CoreHttpRequestParamConfig,
)

from openjiuwen_studio.core.common.dsl import (
    HttpRequestConfig,
    ExceptHandlingMethod,
    ExceptConfig,
    ErrorBody,
)
from openjiuwen_studio.core.common.exceptions import BaseError, JiuWenExecuteException
from openjiuwen_studio.core.common.status_code import StatusCode
from openjiuwen.core.common.logging import logger


class ExceptedCondition(Condition):
    def __init__(self, excepted: bool = False) -> None:
        super().__init__()
        self.excepted: bool = excepted

    def set_excepted(self, excepted: bool) -> None:
        self.excepted = excepted

    def invoke(self, inputs: Input, session: BaseSession) -> bool:
        return self.excepted


class DefaultCondition(Condition):
    def __init__(self, excepted_condition: ExceptedCondition) -> None:
        super().__init__()
        self.excepted_condition = excepted_condition

    def invoke(self, inputs: Input, session: BaseSession) -> bool:
        return not self.excepted_condition.invoke(inputs, session)


class HttpRequestComponent(WorkflowComponent):
    def __init__(self, node_id: str, conf: HttpRequestConfig) -> None:
        self.conf = conf
        self.node_id = node_id
        self._router = BranchRouter()
        self.excepted_condition: ExceptedCondition = None

    def set_excepted_condition(self, excepted_condition: ExceptedCondition) -> None:
        self.excepted_condition = excepted_condition

    def add_branch(
        self,
        condition: Union[str, Callable[[], bool], Condition],
        target: Union[str, List[str]],
        branch_id: str = None,
    ) -> None:
        if isinstance(target, str):
            target = [target]
        self._router.add_branch(condition, target, branch_id=branch_id)

    def add_component(self, graph: Graph, node_id: str, wait_for_all: bool = False) -> None:
        graph.add_node(node_id, self.to_executable(), wait_for_all=wait_for_all)
        graph.add_conditional_edges(node_id, self._router)

    async def invoke(self, inputs: Input, session: Session, context: ModelContext) -> Output:
        self._router.set_session(session)

        exception_config = self.conf.exception_config

        try:
            # Convert studio config to agent-core config
            core_config = self._convert_to_core_config(inputs)

            # Validate URL before making request
            logger.info(
                f"HTTP Request Component - URL: {core_config.request_params.url}, "
                f"Method: {core_config.request_params.method}, "
                f"Query: {core_config.request_params.query_parameters}, "
                f"Headers: {core_config.request_params.headers}"
            )
            if not core_config.request_params.url or not isinstance(core_config.request_params.url, str):
                raise ValueError(f"Invalid URL: {core_config.request_params.url}")

            # Filter out body from inputs for methods that don't support it
            # to prevent agent-core from treating raw body string as HttpRequestBodyConfig
            core_inputs = dict(inputs)
            if core_config.request_params.method.upper() not in ('POST', 'PUT', 'PATCH'):
                core_inputs.pop('body', None)

            # Create and invoke agent-core's HTTPRequestComponent
            core_component = CoreHTTPRequestComponent(core_config)
            response = await core_component.to_executable().invoke(core_inputs, session, context)

            # Process successful response
            final_result = self._process_response(response)
            return final_result

        except TypeError as e:
            # Handle TypeError from BaseError parameter issues
            error_msg = f"HTTP request configuration error: {str(e)}"
            error_body = ErrorBody(error_message=error_msg, error_code=1)
            final_result = self._process_error(error_body, exception_config)
            return final_result
        except Exception as e:
            # Handle all other exceptions based on exception_config
            logger.error(
                f"HTTP Request Component [{self.node_id}] error: "
                f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
            )
            error_msg = str(e) if str(e) else "HTTP request failed"
            error_body = ErrorBody(error_message=error_msg, error_code=1)
            final_result = self._process_error(error_body, exception_config)
            return final_result

    def _convert_to_core_config(self, inputs: Input) -> CoreHttpComponentConfig:
        """Convert studio HttpRequestConfig to agent-core HttpComponentConfig"""
        from openjiuwen.core.workflow.components.tool.http.http_request_component import (
            HttpAuthConfig,
            HttpRequestBodyConfig,
            HttpRetryConfig,
            HttpRateLimitConfig,
            HttpAdvancedOptionsConfig,
            HttpResponseHandlingConfig,
            HttpContentType
        )

        # Method comes from configs (self.conf), not from inputs
        method = self.conf.method.value if hasattr(self.conf.method, 'value') else str(self.conf.method)

        url = inputs.get("url", self.conf.url)

        # Convert headers: merge static config with runtime inputs
        headers = inputs.get("headers", {})
        if not isinstance(headers, dict):
            headers = {}
        # Add static headers from config (UI sidebar key-value pairs)
        for h in self.conf.headers:
            if h.key and h.key not in headers:
                headers[h.key] = str(h.value) if h.value is not None else ""

        # Convert query params: merge static config with runtime inputs
        query_params = inputs.get("query", {})
        if not isinstance(query_params, dict):
            query_params = {}
        # Add static query params from config (UI sidebar key-value pairs)
        for q in self.conf.query_params:
            if q.key and q.key not in query_params:
                query_params[q.key] = str(q.value) if q.value is not None else ""
 
        # Convert body (only for methods that support a body)
        body_config = None
        body_content = inputs.get("body")
        if body_content and body_content != {} and method.upper() in ('POST', 'PUT', 'PATCH'):
            body_config = HttpRequestBodyConfig(
                content_type=HttpContentType.JSON,
                json_data=self.parse_body_content(body_content)
            )

        # Convert auth config
        auth_config = HttpAuthConfig(
            type=self.conf.auth.auth_type,
            username=self.conf.auth.username,
            password=self.conf.auth.password,
            token=self.conf.auth.token,
            api_key=self.conf.auth.api_key,
            in_location=self.conf.auth.api_key_location or "header",
            name=self.conf.auth.api_key_param_name or "Authorization",
        )

        # Convert response handling
        response_handling = HttpResponseHandlingConfig(
            response_format=self.conf.response_handling.response_format,
            response_code_success_codes=self.conf.response_handling.success_status_codes,
            response_code_failure_codes=self.conf.response_handling.failure_status_codes,
            response_mode=self.conf.response_handling.response_mode,
            response_data_property=self.conf.response_handling.data_property,
        )

        # Convert retry config
        retry_config = HttpRetryConfig(
            enabled=self.conf.retry.enabled,
            max_retries=self.conf.retry.max_retries,
            retry_on_status_codes=self.conf.retry.retry_on_status_codes,
            retry_delay=self.conf.retry.retry_delay_ms,
            backoff_type=self.conf.retry.backoff_type,
        )

        # Convert rate limit config
        rate_limit_config = HttpRateLimitConfig(
            enabled=self.conf.rate_limit.enabled,
            requests_per_unit=self.conf.rate_limit.requests_per_unit,
            unit=self.conf.rate_limit.unit,
        )

        # Convert advanced options
        advanced_options = HttpAdvancedOptionsConfig(
            follow_redirect=self.conf.advanced.follow_redirects,
            ignore_ssl_issues=self.conf.advanced.ignore_ssl_issues,
            proxy=self.conf.advanced.proxy_url,
            timeout=self.conf.advanced.timeout,
        )

        # Create core config
        return CoreHttpComponentConfig(
             request_params=CoreHttpRequestParamConfig(
                url=url,
                method=method,
                headers=headers,
                query_parameters=query_params,
                body=body_config,
                authentication=auth_config,
                response_handling=response_handling,
                retry_config=retry_config,
                rate_limit_config=rate_limit_config,
                advanced_options=advanced_options  # HttpAdvancedOptionsConfig(ignore_ssl_issues=True) 
            ),
            # url=url,
            # method=self.conf.method,
            # retry=retry_config,
            # rate_limit=rate_limit_config,
            # advanced=advanced_options,
        )

    @staticmethod
    def parse_body_content(body_content):
        '''Parse body content, if it's a JSON string, convert to dict, otherwise return as is'''
        if isinstance(body_content, str):
            try:
                body_content = json.loads(body_content)
            except json.JSONDecodeError:
                pass
        return body_content

    @staticmethod
    def _replace_variables(text: str, inputs: Input) -> str:
        """Replace {{variable}} placeholders with values from inputs"""
        if not isinstance(text, str):
            return text

        # Find all {{variable}} patterns
        pattern = r'\$\{(?:[^}.]+\.)?([^}.]+)\}'
        matches = re.findall(pattern, text)

        for match in matches:
            name = match.strip()
            value = inputs.get(name, f"{{{{{name}}}}}")
            text = value if isinstance(value, str) else str(value)

        return text

    @staticmethod
    def _process_response(response: Dict[str, Any]) -> Dict[str, Any]:
        """Process successful response"""
        # The response from agent-core HTTPRequestComponent has the format:
        # {
        #   "statusCode": int,
        #   "headers": dict,
        #   "body": str|object,
        #   "url": str,
        #   "ok": bool
        # }
        # Transform to match frontend expectations: error_code, error_msg, data
        return {
            "error_code": 0,  # 0 means success
            "error_msg": "",  # Empty for success
            "data": response.get("body", {}),  # The response body as data
            "is_success": True
        }

    def _process_error(self, error_body: ErrorBody, except_config: ExceptConfig) -> Dict[str, Any]:
        """Process error based on exception config"""
        response_result: Dict[str, Any] = {}

        if except_config.except_handling_method == ExceptHandlingMethod.BREAK:
            raise JiuWenExecuteException(
                code=StatusCode.HTTP_REQUEST_COMPONENT_INVOKE_ERROR.code,
                message=f"HTTP request failed: {error_body.error_message}",
                node_id=self.node_id,
            )
        elif except_config.except_handling_method == ExceptHandlingMethod.EXECUTE_EXCEPT_STEP:
            if self.excepted_condition:
                self.excepted_condition.set_excepted(True)
        else:
            # RETURN_CONTENT
            response_result = except_config.return_content or {}

        # Transform error to match frontend expectations
        response_result["error_code"] = error_body.error_code
        response_result["error_msg"] = error_body.error_message
        response_result["data"] = {}  # Empty data on error
        response_result["is_success"] = False

        return response_result
