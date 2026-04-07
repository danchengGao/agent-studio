#!/usr/bin/env python
# -*- coding: UTF-8 -*-
"""
配置适配器 - 将导出的Agent配置转换为内部DL格式
"""

import os
os.environ.setdefault("DB_TYPE", "none")

from typing import Any, Dict, List, Optional, Tuple, Union
import copy
import json

from openjiuwen.core.common.logging import logger

try:
    from openjiuwen.core.application.llm_agent import ReActAgentConfig, ConstrainConfig
    from openjiuwen.core.single_agent.legacy import WorkflowAgentConfig, DefaultResponse, WorkflowSchema, PluginSchema
    from openjiuwen.core.foundation.llm import BaseModelInfo, ModelConfig
    from openjiuwen.core.common.constants.enums import ControllerType
    from openjiuwen.core.workflow import WorkflowCard
    HAS_CORE_CONFIG = True
except ImportError:
    ReActAgentConfig = None
    WorkflowAgentConfig = None
    ConstrainConfig = None
    DefaultResponse = None
    WorkflowSchema = None
    PluginSchema = None
    BaseModelInfo = None
    ModelConfig = None
    ControllerType = None
    WorkflowCard = None
    HAS_CORE_CONFIG = False


class AgentDLConfig:
    """Agent DL配置"""
    def __init__(
        self,
        agent_base,
        workflows: Optional[List[Any]] = None,
        plugins: Optional[List[Any]] = None,
        knowledge_bases: Optional[List[Any]] = None
    ):
        self.agent_base = agent_base
        self.workflows = workflows or []
        self.plugins = plugins or []
        self.knowledge_bases = knowledge_bases or []


class ConfigAdapter:
    """
    配置适配器
    
    将导出的Agent配置转换为内部DL格式
    """
    
    _build_workflow_func_cache = None
    
    @staticmethod
    def _get_build_workflow_func():
        """
        获取 build_core_workflow_from_ir_dict 函数
        
        直接使用本地的 workflow_builder 模块，无需外部依赖
        
        Returns:
            build_core_workflow_from_ir_dict 函数
        """
        if ConfigAdapter._build_workflow_func_cache is not None:
            return ConfigAdapter._build_workflow_func_cache
        
        from .workflow_builder import build_core_workflow_from_ir_dict
        ConfigAdapter._build_workflow_func_cache = build_core_workflow_from_ir_dict
        return build_core_workflow_from_ir_dict

    
    @staticmethod
    def adapt(
        agent_config: Dict[str, Any]
    ) -> Union["ReActAgentConfig", "WorkflowAgentConfig"]:
        """
        适配配置
        
        Args:
            agent_config: 导出的 agent 配置
            
        Returns:
            ReActAgentConfig 或 WorkflowAgentConfig (来自 openjiuwen.core)
        """
        if not HAS_CORE_CONFIG:
            raise ImportError(
                "Cannot import config classes from openjiuwen.core. "
                "Please ensure openjiuwen is installed correctly."
            )
        
        agent_type = agent_config.get("agent_type", "react").lower()
        
        if agent_type == "react":
            return ConfigAdapter._adapt_react_config(agent_config)
        else:
            return ConfigAdapter._adapt_workflow_config(agent_config)
    
    @staticmethod
    def _adapt_react_config(
        config: Dict[str, Any]
    ) -> "ReActAgentConfig":
        """
        适配 ReAct Agent 配置
        
        Args:
            config: 导出的 agent 配置
            
        Returns:
            ReActAgentConfig (来自 openjiuwen.core)
        """
        model_config = ConfigAdapter._create_core_model_config(config)
        
        workflow_cards = ConfigAdapter._create_workflow_cards(config.get("workflows", []))
        plugin_schemas = ConfigAdapter._create_plugin_schemas(config.get("plugins", []))
        
        prompt_template = config.get("prompt_template", [])
        if isinstance(prompt_template, str):
            prompt_template = [{"role": "system", "content": prompt_template}]
        
        constrain = ConstrainConfig(
            reserved_max_chat_rounds=config.get("constraint", {}).get("reserved_max_chat_rounds", 10),
            max_iteration=config.get("constraint", {}).get("max_iteration", 5),
        )
        
        react_config = ReActAgentConfig(
            id=config.get("agent_id", ""),
            version=config.get("agent_version", "draft"),
            description=config.get("description", ""),
            controller_type=ControllerType.ReActController,
            workflows=workflow_cards,
            model=model_config,
            tools=[],
            prompt_template_name=config.get("prompt_template_name", ""),
            prompt_template=prompt_template,
            constrain=constrain,
            plugins=plugin_schemas,
            memory_scope_id="",
        )
        
        return react_config
    
    @staticmethod
    def _adapt_workflow_config(
        config: Dict[str, Any]
    ) -> "WorkflowAgentConfig":
        """
        适配 Workflow Agent 配置
        
        Args:
            config: 导出的 agent 配置
            
        Returns:
            WorkflowAgentConfig (来自 openjiuwen.core)
        """
        model_config = ConfigAdapter._create_core_model_config(config)
        
        workflow_cards = ConfigAdapter._create_workflow_cards(config.get("workflows", []))
        
        default_response_text = config.get("default_response", "") or "抱歉，我无法理解您的问题，请换一种方式表达"
        
        workflow_config = WorkflowAgentConfig(
            id=config.get("agent_id", ""),
            version=config.get("agent_version", "draft"),
            description=config.get("description", ""),
            controller_type=ControllerType.WorkflowController,
            workflows=workflow_cards,
            model=model_config,
            tools=[],
            default_response=DefaultResponse(text=default_response_text),
        )
        
        return workflow_config
    
    @staticmethod
    def _create_core_model_config(
        config: Dict[str, Any]
    ) -> "ModelConfig":
        """
        创建 openjiuwen.core 的 ModelConfig
        
        Args:
            config: agent 配置
            
        Returns:
            ModelConfig
        """
        model_data = config.get("model", {})
        model_info_data = model_data.get("model_info", {})
        model_name = model_data.get("model_name") or model_info_data.get("model_name", "")
        
        model_info = BaseModelInfo(
            api_key=model_info_data.get("api_key", ""),
            api_base=model_info_data.get("base_url", ""),
            model=model_name,
            temperature=model_info_data.get("temperature", 0.7),
            top_p=model_info_data.get("top_p", 0.9),
            stream=False,
            timeout=model_info_data.get("timeout", 300)
        )
        
        model_provider = model_data.get("model_provider", "OpenAI")
        if model_provider.lower() == 'openai':
            model_provider = 'OpenAI'
        elif model_provider.lower() == 'siliconflow':
            model_provider = 'SiliconFlow'
        
        return ModelConfig(
            model_provider=model_provider,
            model_info=model_info
        )
    
    @staticmethod
    def _create_workflow_cards(
        workflows: List[Any]
    ) -> List["WorkflowCard"]:
        """
        创建 WorkflowCard 列表
        
        Args:
            workflows: 工作流配置列表（可以是字典或 Workflow 对象）
            
        Returns:
            WorkflowCard 列表
        """
        workflow_cards = []
        for wf in workflows:
            if isinstance(wf, dict):
                version = wf.get("workflow_version", wf.get("version", "draft"))
                workflow_id = wf.get("workflow_id", wf.get("id", ""))
                input_params_raw = wf.get("input_params") or wf.get("input_parameters") or []

                workflow_card = WorkflowCard(
                    id=workflow_id,  # 不要添加 version 后缀，generate_workflow_key 会自动添加
                    version=version,
                    name=wf.get("workflow_name", wf.get("name", "")),
                    description=wf.get("description", ""),
                    input_params=ConfigAdapter._convert_input_params_to_schema(input_params_raw),
                )
                workflow_cards.append(workflow_card)
            elif hasattr(wf, 'workflow_id'):
                version = getattr(wf, 'workflow_version', None) or getattr(wf, 'version', 'draft')
                workflow_id = getattr(wf, 'workflow_id', '') or getattr(wf, 'id', '')
                input_params_raw = getattr(wf, 'input_params', []) or []

                workflow_card = WorkflowCard(
                    id=workflow_id,  # 不要添加 version 后缀，generate_workflow_key 会自动添加
                    version=version,
                    name=getattr(wf, 'workflow_name', '') or getattr(wf, 'name', ''),
                    description=getattr(wf, 'description', ''),
                    input_params=ConfigAdapter._convert_input_params_to_schema(input_params_raw),
                )
                workflow_cards.append(workflow_card)
        return workflow_cards
    
    @staticmethod
    def _convert_input_params_to_schema(
        input_params: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        将 input_parameters 列表转换为 JSON Schema 格式
        
        Args:
            input_params: input_parameters 列表，格式如:
                [{"name": "city", "type": "string", "description": "城市名", "required": false}]
            
        Returns:
            JSON Schema 格式:
                {
                    "type": "object",
                    "properties": {
                        "city": {"type": "string", "description": "城市名"}
                    },
                    "required": []
                }
        """
        if not input_params:
            return {"type": "object", "properties": {}, "required": []}
        
        if isinstance(input_params, dict):
            if input_params.get("type") == "object":
                return input_params
            return {"type": "object", "properties": {}, "required": []}
        
        type_mapping = {
            1: "string",
            2: "integer",
            3: "number",
            4: "boolean",
            5: "array",
            6: "object",
            "1": "string",
            "2": "integer",
            "3": "number",
            "4": "boolean",
            "5": "array",
            "6": "object",
            "string": "string",
            "integer": "integer",
            "int": "integer",
            "number": "number",
            "float": "number",
            "boolean": "boolean",
            "bool": "boolean",
            "array": "array",
            "list": "array",
            "object": "object",
            "dict": "object",
        }
        
        properties = {}
        required = []
        
        for param in input_params:
            if not isinstance(param, dict):
                continue
            
            param_name = param.get("name")
            if not param_name:
                continue
            
            param_type = param.get("type", "string")
            param_desc = param.get("description", "") or param.get("desc", "")
            param_required = param.get("required", False) or param.get("is_required", False)
            
            json_type = type_mapping.get(param_type, "string")
            
            properties[param_name] = {
                "type": json_type,
                "description": param_desc,
            }
            
            if param_required:
                required.append(param_name)
        
        return {
            "type": "object",
            "properties": properties,
            "required": required,
        }
    
    @staticmethod
    def preprocess_model_references(workflow_schema: Any, model_refs: Dict[str, Any]) -> Dict[str, Any]:
        """
        预处理 model_references，根据工作流节点中的模型信息添加 model_id 字段
        并注入 API keys
        
        工作流节点中的模型配置格式：{"id": "195", "name": "Qwen/Qwen3-32B", "type": "Qwen/Qwen3-32B"}
        model_references 中的格式：{"siliconflow/Qwen/Qwen3-32B": {"name": "Qwen/Qwen3-32B", ...}}
        
        需要根据 name 字段匹配，并添加 model_id
        """
        if not model_refs:
            return {}
        
        refs_snapshot = copy.deepcopy(model_refs)
        
        from .workflow_builder import inject_api_keys_into_model_references
        processed_refs = inject_api_keys_into_model_references(refs_snapshot)
        
        schema_dict = {}
        if isinstance(workflow_schema, str):
            try:
                schema_dict = json.loads(workflow_schema)
            except:
                pass
        elif isinstance(workflow_schema, dict):
            schema_dict = workflow_schema
        
        nodes = schema_dict.get("nodes", [])
        for node in nodes:
            node_type = str(node.get("type", ""))
            is_llm_node = "llm" in node_type.lower() or node_type == "3"
            
            if is_llm_node:
                model_info = node.get("data", {}).get("inputs", {}).get("llmParam", {}).get("model", {})
                if isinstance(model_info, dict):
                    model_id = str(model_info.get("id", ""))
                    model_name = model_info.get("name", "") or model_info.get("type", "")
                    
                    if model_id and model_name:
                        for key, ref in processed_refs.items():
                            if isinstance(ref, dict):
                                ref_name = ref.get("name", "") or ref.get("model_type", "")
                                if ref_name == model_name:
                                    ref["model_id"] = model_id
                                    break
        
        return processed_refs

    @staticmethod
    def create_workflow_providers(
        workflows: List[Any],
        config: Dict[str, Any],
        model_overrides: Optional[Dict[str, Any]] = None,
        workflow_runner: Optional[Any] = None,
        current_user: Optional[Dict[str, Any]] = None,
        space_id: str = "default",
    ) -> List[Tuple["WorkflowCard", "WorkflowProvider"]]:
        """
        创建工作流提供者列表
        
        关键：返回的 provider 必须是工厂函数，每次调用都创建新的 workflow 实例
        
        Args:
            workflows: 工作流配置列表（Workflow 对象或字典）
            config: 完整的导出配置（包含 dependencies 和 model_references）
            model_overrides: 模型覆盖配置
            workflow_runner: WorkflowRunner 实例，用于从数据库获取 workflow
            current_user: 当前用户信息
            space_id: 空间 ID
            
        Returns:
            List[Tuple[WorkflowCard, WorkflowProvider]] - 工作流卡片和提供者的元组列表
        """
        import json
        import asyncio
        import sys
        from openjiuwen.core.workflow import WorkflowCard
        from openjiuwen.core.runner.resources_manager.base import WorkflowProvider
        
        providers = []
        
        config_model_refs = config.get("model_references", {})
        
        if model_overrides:
            model_refs = {}
            for key, ref in config_model_refs.items():
                model_refs[key] = dict(ref) if isinstance(ref, dict) else {}
            
            for override_key, override in model_overrides.items():
                if hasattr(override, 'model_dump'):
                    override_dict = override.model_dump(exclude_none=True)
                elif isinstance(override, dict):
                    override_dict = override
                else:
                    continue
                
                override_name = override_dict.get("name", "") or override_dict.get("model_type", "")
                matched = False
                
                for key, ref in model_refs.items():
                    ref_name = ref.get("name", "") or ref.get("model_type", "")
                    if override_name and ref_name and override_name == ref_name:
                        ref.update(override_dict)
                        logger.info(f"Merged model_overrides key={override_key} into model_reference key={key}")
                        matched = True
                        break
                
                if not matched and override_name:
                    new_key = f"{override_dict.get('provider', 'unknown')}/{override_name}"
                    model_refs[new_key] = override_dict
                    logger.info(f"Added new model_reference key={new_key} from model_overrides")
        else:
            model_refs = config_model_refs
        
        for wf in workflows:
            try:
                if isinstance(wf, dict):
                    workflow_id = wf.get("workflow_id") or wf.get("id", "")
                    workflow_name = wf.get("workflow_name") or wf.get("name", "")
                    workflow_version = wf.get("workflow_version") or wf.get("version", "draft")
                    workflow_desc = wf.get("description", "")
                    workflow_schema = wf.get("schema", {})
                    input_params_raw = wf.get("input_params") or wf.get("input_parameters") or []
                elif hasattr(wf, 'workflow_id'):
                    workflow_id = getattr(wf, 'workflow_id', '') or getattr(wf, 'id', '')
                    workflow_name = getattr(wf, 'workflow_name', '') or getattr(wf, 'name', '')
                    workflow_version = getattr(wf, 'workflow_version', None) or getattr(wf, 'version', 'draft')
                    workflow_desc = getattr(wf, 'description', '')
                    workflow_schema = getattr(wf, 'schema', {})
                    input_params_raw = getattr(wf, 'input_params', []) or getattr(wf, 'input_parameters', [])
                else:
                    continue
                
                workflow_card = WorkflowCard(
                    id=workflow_id,  # 不要添加 version 后缀，generate_workflow_key 会自动添加
                    name=workflow_name,
                    description=workflow_desc,
                    version=workflow_version,
                    input_params=ConfigAdapter._convert_input_params_to_schema(input_params_raw),
                )
                
                def make_provider(wf_id: str, wf_version: str, wf_schema: dict, wf_config: dict, model_refs: dict):
                    async def provider() -> "Workflow":
                        try:
                            logger.info(
                                "Provider called: id=%s, version=%s, workflow_runner=%s",
                                wf_id,
                                wf_version,
                                workflow_runner is not None
                            )
                            
                            # 深拷贝配置，避免状态污染
                            workflow_schema_snapshot = copy.deepcopy(wf_schema)
                            model_refs_snapshot = copy.deepcopy(model_refs)
                            
                            if workflow_runner is not None:
                                # FIX: 使用 get_flow() + compile() 获取编译后的 workflow
                                # 每次调用都创建新的实例，避免状态污染
                                from openjiuwen_studio.core.executor.workflow.context import Context
                                
                                logger.info(
                                    "Building workflow provider via runner: id=%s, version=%s",
                                    wf_id,
                                    wf_version,
                                )
                                
                                # 获取新的 flow 实例（未编译），然后编译创建全新实例
                                fresh_flow = await workflow_runner.get_flow(
                                    wf_id, wf_version, space_id, current_user
                                )
                                # 每次调用都重新编译，确保全新实例
                                workflow = await fresh_flow.compile(Context(), workflow_runner)
                                
                                logger.info(
                                    "Building workflow provider via runner done: id=%s, version=%s",
                                    wf_id,
                                    wf_version,
                                )
                                return workflow
                            else:
                                # 本地构建逻辑（无 workflow_runner 时）
                                logger.info(
                                    "Building workflow provider locally: id=%s, version=%s",
                                    wf_id,
                                    wf_version,
                                )
                                
                                build_workflow_func = ConfigAdapter._get_build_workflow_func()
                                if build_workflow_func is None:
                                    raise ImportError("Could not find build_core_workflow_from_ir_dict function")

                                ir_dict = {
                                    "workflow_id": wf_id,
                                    "workflow_version": wf_version,
                                    "schema": workflow_schema_snapshot,
                                    "model_references": model_refs_snapshot,
                                }

                                if isinstance(workflow_schema_snapshot, str):
                                    schema_dict = json.loads(workflow_schema_snapshot)
                                    ir_dict["nodes"] = copy.deepcopy(schema_dict.get("nodes", []))
                                    ir_dict["edges"] = copy.deepcopy(schema_dict.get("edges", []))
                                elif isinstance(workflow_schema_snapshot, dict):
                                    ir_dict["nodes"] = copy.deepcopy(workflow_schema_snapshot.get("nodes", []))
                                    ir_dict["edges"] = copy.deepcopy(workflow_schema_snapshot.get("edges", []))

                                workflow = await build_workflow_func(ir_dict)
                                logger.info(
                                    "Building workflow provider locally done: id=%s, version=%s",
                                    wf_id,
                                    wf_version,
                                )
                                return workflow
                        except Exception as e:
                            logger.error(f"Failed to build workflow {wf_id}: {e}")
                            import traceback
                            traceback.print_exc()
                            raise
                    return provider
                
                provider = make_provider(
                    workflow_id,
                    workflow_version,
                    workflow_schema,
                    wf,
                    ConfigAdapter.preprocess_model_references(workflow_schema, model_refs),
                )
                providers.append((workflow_card, provider))
                logger.info(f"Created workflow provider: {workflow_name} (id={workflow_id})")
                
            except Exception as e:
                logger.error(f"Failed to create workflow provider: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        return providers

    @staticmethod
    def _create_plugin_schemas(
        plugins: List[Dict[str, Any]]
    ) -> List["PluginSchema"]:
        """
        创建 PluginSchema 列表
        
        Args:
            plugins: 插件配置列表
            
        Returns:
            PluginSchema 列表
        """
        plugin_schemas = []
        for plugin in plugins:
            if isinstance(plugin, dict):
                plugin_schema = PluginSchema(
                    id=plugin.get("plugin_id", plugin.get("id", "")),
                    version=plugin.get("plugin_version", plugin.get("version", "draft")),
                    name=plugin.get("plugin_name", plugin.get("name", "")),
                    description=plugin.get("description", ""),
                    inputs=plugin.get("inputs", {}),
                    plugin_id=plugin.get("plugin_id", plugin.get("id", "")),
                )
                plugin_schemas.append(plugin_schema)
        return plugin_schemas
    
    @staticmethod
    def _extract_model_config(
        config: Dict[str, Any]
    ) -> ModelConfig:
        """
        提取模型配置
        
        Args:
            config: agent 配置
            
        Returns:
            ModelConfig
        """
        model_data = config.get("model", {})
        
        # 处理不同的模型配置格式
        if "model_info" in model_data:
            model_info = model_data["model_info"]
            return ModelConfig(
                model_provider=model_data.get("model_provider", "OpenAI"),
                model_name=model_info.get("model_name", "gpt-4"),
                temperature=model_info.get("temperature", 0.7),
                top_p=model_info.get("top_p", 0.9),
                max_tokens=model_info.get("max_tokens", 2000),
                timeout=model_info.get("timeout", 300),
                api_key=model_info.get("api_key"),
                base_url=model_info.get("base_url")
            )
        else:
            return ModelConfig(
                model_provider=model_data.get("model_provider", "OpenAI"),
                model_name=model_data.get("model_name", "gpt-4"),
                temperature=model_data.get("temperature", 0.7),
                top_p=model_data.get("top_p", 0.9),
                max_tokens=model_data.get("max_tokens", 2000),
                timeout=model_data.get("timeout", 300),
                api_key=model_data.get("api_key"),
                base_url=model_data.get("base_url")
            )
    
    @staticmethod
    def _extract_tools(
        config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        提取工具配置
        
        Args:
            config: agent 配置
            
        Returns:
            工具配置列表
        """
        tools = []
        
        # 从 plugins 提取工具
        plugins = config.get("plugins", [])
        for plugin in plugins:
            if isinstance(plugin, dict):
                tools.append({
                    "type": "plugin",
                    "name": plugin.get("plugin_name", ""),
                    "id": plugin.get("plugin_id", ""),
                    "config": plugin.get("config", {})
                })
        
        # 从 tools 字段提取
        if "tools" in config:
            for tool in config["tools"]:
                if isinstance(tool, dict):
                    tools.append(tool)
        
        return tools
    
    @staticmethod
    def _extract_memory_config(
        config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        提取记忆配置
        
        Args:
            config: agent 配置
            
        Returns:
            记忆配置或 None
        """
        memory = config.get("memory")
        if not memory:
            return None
        
        if isinstance(memory, dict):
            return {
                "enabled": memory.get("enabled", True),
                "type": memory.get("type", "conversation"),
                "max_turns": memory.get("max_turns", 10),
                "storage": memory.get("storage", "local")
            }
        
        return {"enabled": True, "type": "conversation"}
    
    @staticmethod
    def convert_to_agent_dl_config(
        agent_config: Dict[str, Any],
        workflows: Optional[List[Any]] = None,
        plugins: Optional[List[Any]] = None,
        knowledge_bases: Optional[List[Any]] = None
    ) -> AgentDLConfig:
        """
        转换为 AgentDLConfig
        
        Args:
            agent_config: agent 配置
            workflows: 工作流列表
            plugins: 插件列表
            knowledge_bases: 知识库列表
            
        Returns:
            AgentDLConfig
        """
        base_config = ConfigAdapter.adapt(agent_config)
        
        dl_config = AgentDLConfig(
            agent_base=base_config,
            workflows=workflows or [],
            plugins=plugins or [],
            knowledge_bases=knowledge_bases or []
        )
        
        return dl_config
    
    @staticmethod
    def adapt_to_runtime_config(
        config: Dict[str, Any],
        workflows: Optional[List[Dict[str, Any]]] = None,
        plugins: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        适配为 Runtime 环境使用的配置
        
        用于 openjiuwen.core.single_agent.agents.react_agent.ReActAgent.configure()
        
        Args:
            config: 导出的 agent 配置
            workflows: 工作流配置列表（可选，如果提供会合并到返回结果中）
            plugins: 插件配置列表（可选，如果提供会合并到返回结果中）
            
        Returns:
            Dict 包含:
            {
                "runtime_config": ReActAgentConfig,
                "workflow_cards": List[WorkflowCard],
                "tool_cards": List[ToolCard]
            }
        """
        from openjiuwen.core.single_agent.agents.react_agent import ReActAgentConfig as RuntimeReActAgentConfig
        from openjiuwen.core.foundation.llm.schema.config import ModelClientConfig, ModelRequestConfig
        from openjiuwen.core.foundation.tool import ToolCard
        
        model_data = config.get("model", {})
        model_info_data = model_data.get("model_info", {})
        
        prompt_template = config.get("prompt_template", [])
        if isinstance(prompt_template, str):
            prompt_template = [{"role": "system", "content": prompt_template}]
        
        model_name = model_data.get("model_name", "")
        model_provider = model_data.get("model_provider", "openai")
        api_key = model_info_data.get("api_key", "")
        api_base = model_info_data.get("base_url", "")
        
        model_client_config = ModelClientConfig(
            client_provider=model_provider,
            api_key=api_key,
            api_base=api_base,
            verify_ssl=False
        )
        
        model_config_obj = ModelRequestConfig(
            model_name=model_name,
            temperature=model_info_data.get("temperature", 0.7),
            top_p=model_info_data.get("top_p", 0.9),
            max_tokens=model_info_data.get("max_tokens", 2000)
        )
        
        runtime_config = RuntimeReActAgentConfig(
            mem_scope_id="",
            model_name=model_name,
            model_provider=model_provider,
            api_key=api_key,
            api_base=api_base,
            prompt_template_name=config.get("prompt_template_name", ""),
            prompt_template=prompt_template,
            max_iterations=config.get("constraint", {}).get("max_iteration", 5),
            model_client_config=model_client_config,
            model_config_obj=model_config_obj,
        )
        
        workflow_cards = ConfigAdapter._create_workflow_cards(workflows or [])
        
        tool_cards = ConfigAdapter._create_tool_cards(plugins or [])
        
        return {
            "runtime_config": runtime_config,
            "workflow_cards": workflow_cards,
            "tool_cards": tool_cards,
        }
    
    @staticmethod
    def _create_tool_cards(
        plugins: List[Any]
    ) -> List[Any]:
        """
        创建 ToolCard 列表
        
        Args:
            plugins: 插件配置列表（可以是字典或 Tool 对象）
            
        Returns:
            ToolCard 列表
        """
        from openjiuwen.core.foundation.tool import ToolCard
        
        tool_cards = []
        for plugin in plugins:
            if isinstance(plugin, dict):
                plugin_id = plugin.get("plugin_id") or plugin.get("id", "")
                plugin_name = plugin.get("plugin_name") or plugin.get("name", "Unnamed Plugin")
                description = plugin.get("description", "") or plugin.get("desc", "")
                
                input_params_raw = []
                tool_list = plugin.get("tool_list", [])
                if tool_list and isinstance(tool_list, list) and len(tool_list) > 0:
                    first_tool = tool_list[0]
                    if isinstance(first_tool, dict):
                        input_params_raw = (
                            first_tool.get("input_parameters") or 
                            first_tool.get("request_params") or 
                            []
                        )
                        if not plugin_id:
                            plugin_id = first_tool.get("tool_id", "")
                        if not plugin_name:
                            plugin_name = first_tool.get("name", "")
                        if not description:
                            description = first_tool.get("desc", "") or first_tool.get("description", "")
                
                if not input_params_raw:
                    input_params_raw = (
                        plugin.get("input_parameters") or 
                        plugin.get("request_params") or 
                        plugin.get("input_schema") or 
                        []
                    )
                
                input_schema = ConfigAdapter._convert_input_params_to_schema(input_params_raw)
                
                tool_card = ToolCard(
                    id=plugin_id,
                    name=plugin_name,
                    description=description,
                    input_params=input_schema,
                )
                tool_cards.append(tool_card)
            elif hasattr(plugin, 'tool_id'):
                plugin_id = getattr(plugin, 'tool_id', '') or getattr(plugin, 'id', '')
                plugin_name = getattr(plugin, 'tool_name', '') or getattr(plugin, 'name', 'Unnamed Plugin')
                description = getattr(plugin, 'description', '')
                
                input_params_raw = []
                if hasattr(plugin, 'input_parameters'):
                    input_params_raw = getattr(plugin, 'input_parameters', [])
                elif hasattr(plugin, 'request_params'):
                    input_params_raw = getattr(plugin, 'request_params', [])
                elif hasattr(plugin, 'input_schema'):
                    input_schema = getattr(plugin, 'input_schema', {})
                    if isinstance(input_schema, dict) and input_schema.get("type") == "object":
                        input_params_raw = input_schema
                
                input_schema = ConfigAdapter._convert_input_params_to_schema(input_params_raw)
                
                tool_card = ToolCard(
                    id=plugin_id,
                    name=plugin_name,
                    description=description,
                    input_params=input_schema,
                )
                tool_cards.append(tool_card)
        return tool_cards
    
    @staticmethod
    def create_plugin_tools(
        plugins: List[Any]
    ) -> List[Any]:
        """
        从插件配置创建 Tool 实例列表

        Args:
            plugins: 插件配置列表

        Returns:
            Tool 实例列表
        """
        from openjiuwen.core.foundation.tool.base import Tool, ToolCard, Input, Output
        from typing import AsyncIterator
        
        class RuntimePluginTool(Tool):
            """运行时插件工具 - 不依赖数据库"""
            
            def __init__(self, card: ToolCard, code: str, language: str = "python"):
                super().__init__(card)
                self.code = code
                self.language = language
            
            async def invoke(self, inputs: Input, **kwargs) -> Output:
                import asyncio
                import json
                import subprocess
                import tempfile
                import os
                from typing import Any, Dict
                
                if self.language == "python":
                    class Args:
                        def __init__(self, params: Dict[str, Any]):
                            self.params = params
                    
                    input_params = getattr(inputs, 'inputs', inputs)
                    if isinstance(input_params, dict):
                        args_obj = Args(input_params)
                    else:
                        args_obj = Args({})
                    
                    exec_namespace = {
                        "__builtins__": __builtins__,
                        "inputs": inputs, 
                        "json": json, 
                        "asyncio": asyncio,
                        "Args": Args,
                        "args": args_obj,
                    }
                    
                    try:
                        exec(self.code, exec_namespace)
                        
                        if "main" in exec_namespace and callable(exec_namespace["main"]):
                            result = exec_namespace["main"](args_obj)
                            if asyncio.iscoroutine(result):
                                result = await result
                            return result
                        elif "run" in exec_namespace and callable(exec_namespace["run"]):
                            result = exec_namespace["run"](args_obj)
                            if asyncio.iscoroutine(result):
                                result = await result
                            return result
                        else:
                            last_expr = self.code.strip().split("\n")[-1]
                            if last_expr and not last_expr.startswith((" ", "\t", "import ", "from ", "def ", "class ")):
                                try:
                                    result = eval(last_expr, exec_namespace)
                                    if asyncio.iscoroutine(result):
                                        result = await result
                                    return result
                                except:
                                    pass
                            return exec_namespace.get("result", inputs)
                    except Exception as e:
                        logger.error(f"Plugin code execution error: {e}")
                        return {"error": str(e)}
                elif self.language in ("javascript", "js"):
                    try:
                        input_params = getattr(inputs, 'inputs', inputs)
                        if not isinstance(input_params, dict):
                            input_params = {}
                        
                        wrapper_code = f'''
const args = {{ params: {json.dumps(input_params)} }};

{self.code}

if (typeof main === 'function') {{
    const result = main(args);
    if (result instanceof Promise) {{
        result.then(r => console.log(JSON.stringify(r))).catch(e => console.log(JSON.stringify({{error: e.message}})));
    }} else {{
        console.log(JSON.stringify(result));
    }}
}} else if (typeof run === 'function') {{
    const result = run(args);
    if (result instanceof Promise) {{
        result.then(r => console.log(JSON.stringify(r))).catch(e => console.log(JSON.stringify({{error: e.message}})));
    }} else {{
        console.log(JSON.stringify(result));
    }}
}} else {{
    console.log(JSON.stringify({{result: "no main or run function found"}}));
}}
'''
                        
                        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
                            f.write(wrapper_code)
                            temp_file = f.name
                        
                        try:
                            process = await asyncio.create_subprocess_exec(
                                'node', temp_file,
                                stdout=asyncio.subprocess.PIPE,
                                stderr=asyncio.subprocess.PIPE
                            )
                            stdout, stderr = await asyncio.wait_for(
                                process.communicate(),
                                timeout=kwargs.get('timeout', 30)
                            )
                            
                            if process.returncode != 0:
                                error_msg = stderr.decode('utf-8') if stderr else 'Unknown error'
                                logger.error(f"JavaScript execution error: {error_msg}")
                                return {"error": error_msg}
                            
                            output = stdout.decode('utf-8').strip()
                            if output:
                                try:
                                    return json.loads(output)
                                except json.JSONDecodeError:
                                    return {"result": output}
                            return {}
                        finally:
                            os.unlink(temp_file)
                    except asyncio.TimeoutError:
                        logger.error("JavaScript execution timeout")
                        return {"error": "Execution timeout"}
                    except FileNotFoundError:
                        logger.error("Node.js not found")
                        return {"error": "Node.js is not installed or not in PATH"}
                    except Exception as e:
                        logger.error(f"JavaScript execution error: {e}")
                        return {"error": str(e)}
                else:
                    return {"error": f"Unsupported language: {self.language}"}
            
            async def stream(self, inputs: Input, **kwargs) -> AsyncIterator[Output]:
                """Stream method - for simplicity, just yield the invoke result"""
                result = await self.invoke(inputs, **kwargs)
                yield result
        
        def convert_params_to_json_schema(params):
            """将参数列表转换为 JSON Schema"""
            type_mapping = {
                "string": "string",
                "integer": "integer",
                "number": "number",
                "boolean": "boolean",
                "array": "array",
                "object": "object",
            }
            
            properties = {}
            required = []
            
            for param in params:
                param_name = param.name if hasattr(param, 'name') else param.get("name", "")
                param_type = param.type if hasattr(param, 'type') else param.get("type", "string")
                param_desc = param.description if hasattr(param, 'description') else param.get("description", "")
                param_required = param.required if hasattr(param, 'required') else param.get("required", False)
                
                if isinstance(param_type, int):
                    int_type_map = {1: "string", 2: "integer", 3: "number", 4: "boolean", 5: "array", 6: "object"}
                    param_type = int_type_map.get(param_type, "string")
                
                properties[param_name] = {
                    "type": type_mapping.get(param_type, "string"),
                    "description": param_desc
                }
                if param_required:
                    required.append(param_name)
            
            return {
                "type": "object",
                "properties": properties,
                "required": required
            }
        
        tools = []
        for plugin in plugins:
            try:
                tool_instance = None
                
                if isinstance(plugin, dict):
                    plugin_id = plugin.get("plugin_id") or plugin.get("id", "")
                    plugin_name = plugin.get("plugin_name") or plugin.get("name", "Unnamed Plugin")
                    description = plugin.get("description", "") or plugin.get("desc", "")
                    
                    tool_list = plugin.get("tool_list", [])
                    if tool_list and isinstance(tool_list, list) and len(tool_list) > 0:
                        first_tool = tool_list[0]
                        if isinstance(first_tool, dict):
                            code = first_tool.get("code", "")
                            language = first_tool.get("language", "python")
                            request_params = first_tool.get("request_params", [])
                            
                            if code:
                                type_mapping = {
                                    1: "string", 2: "integer", 3: "number",
                                    4: "boolean", 5: "array", 6: "object",
                                    "1": "string", "2": "integer", "3": "number",
                                    "4": "boolean", "5": "array", "6": "object",
                                }
                                
                                class Param:
                                    def __init__(self, name, description, type, required, default_value, method, runtime):
                                        self.name = name
                                        self.description = description
                                        self.type = type
                                        self.required = required
                                        self.default_value = default_value
                                        self.method = method
                                        self.runtime = runtime
                                
                                params_list = []
                                for rp in request_params:
                                    param_type = type_mapping.get(rp.get("type", 1), "string")
                                    params_list.append(Param(
                                        name=rp.get("name", ""),
                                        description=rp.get("desc", ""),
                                        type=param_type,
                                        required=rp.get("is_required", False),
                                        default_value=rp.get("value", ""),
                                        method="body",
                                        runtime=rp.get("is_runtime", True)
                                    ))
                                
                                input_schema = convert_params_to_json_schema(params_list)
                                
                                tool_card = ToolCard(
                                    id=first_tool.get("tool_id", plugin_id),
                                    name=first_tool.get("name", plugin_name),
                                    description=first_tool.get("desc", description),
                                    input_params=input_schema
                                )
                                
                                tool_instance = RuntimePluginTool(
                                    card=tool_card,
                                    code=code,
                                    language=language
                                )
                
                if tool_instance:
                    tools.append(tool_instance)
                    logger.info(f"Created tool instance: {getattr(tool_instance, 'name', 'unknown')}")
                else:
                    logger.warning(f"Could not create tool instance for plugin: {plugin.get('name', 'unknown')}")
                    
            except Exception as e:
                logger.error(f"Error creating tool instance: {e}")
                continue
        
        return tools
