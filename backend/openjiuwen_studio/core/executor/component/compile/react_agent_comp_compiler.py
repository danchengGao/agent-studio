#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import Any, Dict, Optional, List, TYPE_CHECKING
from openjiuwen.core.workflow.components.llm.react import ReActAgentCompConfig
from openjiuwen.core.foundation.llm import (
    ModelRequestConfig,
    ModelClientConfig,
    SystemMessage,
    UserMessage,
)
from openjiuwen.core.context_engine import ContextEngineConfig
from openjiuwen.core.runner import Runner
from openjiuwen.core.common.logging import logger

from openjiuwen_studio.core.common.dsl import (
    ReactAgentConfig as ReactAgentConfigDL,
    PluginSchema,
    WorkflowSchema,
)
from openjiuwen_studio.core.executor.component.compile.base_comp_compiler import BaseCompCompiler
from openjiuwen_studio.core.executor.component.component_impl.react_agent_comp import (
    ReActAgentCompWithTools,
)

if TYPE_CHECKING:
    from openjiuwen_studio.core.executor.plugin.plugin_mgr import PluginManager
    from openjiuwen_studio.core.executor.workflow.workflow_runner import WorkflowRunner

client_provider_mapping = {
    "siliconflow": "SiliconFlow",
    "openai": "OpenAI",
}


def parse_model_config(
    comp_config_dict: Dict[str, Any],
) -> tuple[ModelRequestConfig, ModelClientConfig, str]:
    """
    Parse model configuration and return ModelRequestConfig, ModelClientConfig, and model_id
    Args:
        comp_config_dict: React agent component configuration dictionary
    Returns:
        tuple: (model_request_config, model_client_config, model_id)
    """
    react_agent_config_dl = ReactAgentConfigDL.model_validate(comp_config_dict)
    base_model_request_config = react_agent_config_dl.model.request_config
    base_model_client_config = react_agent_config_dl.model.model_client_config

    # Create ModelRequestConfig
    model_request_config = ModelRequestConfig(
        model=base_model_request_config.model_name,
        temperature=base_model_request_config.temperature,
        top_p=base_model_request_config.top_p,
    )

    # Create ModelClientConfig
    model_client_config = ModelClientConfig(
        client_provider=client_provider_mapping.get(
            base_model_client_config.client_provider, base_model_client_config.client_provider
        ),
        api_key=base_model_client_config.api_key,
        api_base=base_model_client_config.api_base,
        timeout=base_model_client_config.timeout,
        max_retries=1,
        verify_ssl=False,
    )

    # model_id uses model_name
    model_id = base_model_request_config.model_name
    return model_request_config, model_client_config, model_id


def parse_template_content(template_content: list) -> tuple[SystemMessage, UserMessage]:
    """
    Parse system_prompt_template and user_prompt_template from template_content
    Args:
        template_content: Template content list, each element is {"role": "system"/"user", "content": "..."}
    Returns:
        tuple: (system_prompt_template, user_prompt_template)
    """
    system_prompt_template = None
    user_prompt_template = None
    if not template_content:
        return None, None

    for msg in template_content:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "system":
            system_prompt_template = SystemMessage(content=content)
        elif role == "user":
            user_prompt_template = UserMessage(content=content)
    return system_prompt_template, user_prompt_template


class ReactAgentCompCompiler(BaseCompCompiler):
    def __init__(
        self,
        react_agent_config_dict: Dict[str, Any],
        plugin_mgr: Optional["PluginManager"] = None,
        workflow_mgr: Optional["WorkflowRunner"] = None,
        space_id: Optional[str] = None,
        current_user: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__()
        self.config_dict = react_agent_config_dict
        self.config = ReactAgentConfigDL.model_validate(react_agent_config_dict)
        self.plugin_mgr = plugin_mgr
        self.workflow_mgr = workflow_mgr
        self.space_id = space_id
        self.current_user = current_user

    async def _compile_plugin_tools(self) -> List[Any]:
        """
        Compile selected plugins to Tool instances
        Returns:
            List of compiled Tool instances
        """
        plugin_count = len(self.config.selected_plugins) if self.config.selected_plugins else 0
        logger.debug(
            f"_compile_plugin_tools called: plugin_mgr={self.plugin_mgr is not None}, "
            f"selected_plugins={plugin_count}"
        )
        if not self.plugin_mgr or not self.config.selected_plugins:
            logger.debug(
                f"_compile_plugin_tools skipping: plugin_mgr={self.plugin_mgr is not None}, "
                f"has_plugins={bool(self.config.selected_plugins)}"
            )
            return []

        compiled_tools = []
        seen_tool_names = set()  # Track tool names to avoid duplicates
        seen_plugin_ids = set()  # Track plugin IDs to avoid duplicates

        for plugin_schema in self.config.selected_plugins:
            try:
                # Create a unique key for this plugin
                plugin_key = f"{plugin_schema.plugin_id}:{plugin_schema.id}:{plugin_schema.version}"

                # Skip if this plugin has already been processed
                if plugin_key in seen_plugin_ids:
                    logger.warning(f"Skipping duplicate plugin in selected_plugins: {plugin_key}")
                    continue
                seen_plugin_ids.add(plugin_key)

                logger.debug(
                    f"Attempting to compile plugin: id={plugin_schema.id}, "
                    f"plugin_id={plugin_schema.plugin_id}, version={plugin_schema.version}"
                )
                # Get the compiled tool from plugin manager
                compiled_tool = await self.plugin_mgr.get_compiled_tool(
                    plugin_id=plugin_schema.plugin_id,
                    tool_id=plugin_schema.id,
                    space_id=self.space_id,
                    version=plugin_schema.version,
                    current_user=self.current_user,
                )

                tool_name = compiled_tool.card.name if hasattr(compiled_tool, "card") else "unknown"

                # Skip if a tool with this name has already been compiled
                if tool_name in seen_tool_names:
                    logger.warning(f"Skipping tool with duplicate name: {tool_name}")
                    continue
                seen_tool_names.add(tool_name)

                compiled_tools.append(compiled_tool)
                logger.debug(f"Compiled tool: {tool_name}")
            except Exception as e:
                logger.error(
                    f"Failed to compile plugin tool {plugin_schema.id}: {e}", exc_info=True
                )

        return compiled_tools

    async def _register_plugins(self) -> List[str]:
        """
        Register selected plugins with Runner.resource_mgr
        Returns:
            List of registered tool IDs
        """
        plugin_count = len(self.config.selected_plugins) if self.config.selected_plugins else 0
        logger.debug(
            f"_register_plugins called: plugin_mgr={self.plugin_mgr is not None}, "
            f"selected_plugins={plugin_count}"
        )
        if not self.plugin_mgr or not self.config.selected_plugins:
            logger.debug(
                f"_register_plugins skipping: plugin_mgr={self.plugin_mgr is not None}, "
                f"has_plugins={bool(self.config.selected_plugins)}"
            )
            return []

        registered_tool_ids = []
        for plugin_schema in self.config.selected_plugins:
            try:
                logger.debug(
                    f"Attempting to register plugin: id={plugin_schema.id}, "
                    f"plugin_id={plugin_schema.plugin_id}, version={plugin_schema.version}"
                )
                # Get the compiled tool from plugin manager
                compiled_tool = await self.plugin_mgr.get_compiled_tool(
                    plugin_id=plugin_schema.plugin_id,
                    tool_id=plugin_schema.id,
                    space_id=self.space_id,
                    version=plugin_schema.version,
                    current_user=self.current_user,
                )

                # Register with Runner.resource_mgr
                tool_id = plugin_schema.id
                Runner.resource_mgr.add_tool(compiled_tool)
                registered_tool_ids.append(tool_id)
                logger.debug(f"Registered tool: {tool_id}")
            except Exception as e:
                logger.error(
                    f"Failed to register plugin tool {plugin_schema.id}: {e}", exc_info=True
                )

        return registered_tool_ids

    async def _register_workflows(self) -> List[str]:
        """
        Register selected workflows with Runner.resource_mgr
        Returns:
            List of registered workflow IDs
        """
        if not self.workflow_mgr or not self.config.selected_workflows:
            return []

        registered_workflow_ids = []
        seen_workflow_keys = set()  # Track workflow keys to avoid duplicates

        for workflow_schema in self.config.selected_workflows:
            try:
                # Create a unique key for this workflow
                workflow_key = f"{workflow_schema.id}:{workflow_schema.version}"

                # Skip if this workflow has already been processed
                if workflow_key in seen_workflow_keys:
                    logger.warning(
                        f"Skipping duplicate workflow in selected_workflows: {workflow_key}"
                    )
                    continue
                seen_workflow_keys.add(workflow_key)

                # Get the compiled workflow
                workflow = await self.workflow_mgr.get_compiled_workflow(
                    id=workflow_schema.id,
                    version=workflow_schema.version,
                    space_id=self.space_id,
                    current_user=self.current_user,
                )

                # Register with Runner.resource_mgr
                try:
                    Runner.resource_mgr.add_workflow(workflow)
                    logger.debug(f"Registered workflow: {workflow_schema.id}")
                except Exception as e:
                    # Workflow might already exist in resource_mgr, log warning but continue
                    logger.warning(
                        f"Workflow may already exist in Runner.resource_mgr: {workflow_schema.id}, "
                        f"error: {e}"
                    )

                registered_workflow_ids.append(workflow_schema.id)
            except Exception as e:
                logger.error(f"Failed to register workflow {workflow_schema.id}: {e}")

        return registered_workflow_ids

    async def compile(self) -> ReActAgentCompWithTools:
        """
        Compile the React Agent component configuration into a ReActAgentCompWithTools instance
        Returns:
            ReActAgentCompWithTools: The compiled React Agent workflow component with tools
        """
        # Log compilation start with diagnostic info
        logger.debug(f"ReActAgentCompCompiler.compile() called")
        logger.debug(f"  plugin_mgr: {self.plugin_mgr}")
        logger.debug(f"  workflow_mgr: {self.workflow_mgr}")
        logger.debug(f"  space_id: {self.space_id}")

        plugin_count = len(self.config.selected_plugins) if self.config.selected_plugins else 0
        workflow_count = (
            len(self.config.selected_workflows) if self.config.selected_workflows else 0
        )
        logger.debug(f"  selected_plugins count: {plugin_count}")
        logger.debug(f"  selected_workflows count: {workflow_count}")

        if self.config.selected_plugins:
            for p in self.config.selected_plugins:
                logger.debug(f"    Plugin: id={p.id}, plugin_id={p.plugin_id}, version={p.version}")
        if self.config.selected_workflows:
            for w in self.config.selected_workflows:
                logger.debug(f"    Workflow: id={w.id}, version={w.version}")

        # Compile plugin tools
        # Note: Workflows are registered in agent.py's compile() method via invokable_agent.add_workflows()
        # to avoid duplicate registration. We only compile plugin tools here.
        compiled_tools = await self._compile_plugin_tools()

        # Log compiled tools
        logger.debug(f"ReAct Agent Component: compiled {len(compiled_tools)} tools")
        if compiled_tools:
            tool_names = [t.card.name for t in compiled_tools]
            logger.debug(f"  Tool names: {tool_names}")

        # Parse model configuration
        model_request_config, model_client_config, model_id = parse_model_config(self.config_dict)

        # Build context engine config
        context_engine_config = ContextEngineConfig(
            max_context_message_num=self.config.max_context_message_num or 200,
            default_window_round_num=self.config.default_window_round_num or 10,
        )

        # Create ReActAgentCompConfig
        react_agent_workflow_config = ReActAgentCompConfig(
            mem_scope_id=self.config.mem_scope_id or "",
            model_name=model_id,
            model_provider=model_client_config.client_provider,
            api_key=model_client_config.api_key,
            api_base=model_client_config.api_base,
            prompt_template_name=self.config.prompt_template_name,
            prompt_template=self.config.prompt_template,
            max_iterations=self.config.max_iterations,
            model_client_config=model_client_config,
            model_config_obj=model_request_config,
            sys_operation_id=None,  # Not needed for plugin tools
            context_engine_config=context_engine_config,
        )

        # Create and return the ReActAgentCompWithTools component with compiled tools
        logger.debug(f"Creating ReActAgentCompWithTools with {len(compiled_tools)} tools")
        return ReActAgentCompWithTools(react_agent_workflow_config, compiled_tools)
