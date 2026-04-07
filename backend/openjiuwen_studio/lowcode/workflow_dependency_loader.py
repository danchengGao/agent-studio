#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
工作流依赖解析器 - 从导出 JSON 的 dependencies.workflows 解析子工作流

使 ExecutorWorkflow.compile 无需查库。
"""

from __future__ import annotations

import os
from typing import Any, Dict, Tuple

from openjiuwen.core.common.logging import logger
from openjiuwen.core.workflow.workflow import Workflow as InvokableWorkflow
from openjiuwen_studio.core.common import dsl as studio_dsl
from openjiuwen_studio.core.executor.workflow.context import Context
from openjiuwen_studio.core.executor.workflow.workflow import IWorkflowLoader, Workflow as ExecutorWorkflow


WorkflowKey = Tuple[str, str]


class WorkflowLlmApiKeyMissingError(Exception):
    """DSL LLM/意图/提问器节点：可解析的 LLM_KEY__* 与 JSON 内 api_key 均未配置。"""


def strip_dependencies(wf: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in wf.items() if k != "dependencies"}


def collect_workflow_registry(root: Dict[str, Any]) -> Dict[WorkflowKey, Dict[str, Any]]:
    """扁平化收集所有嵌套 dependencies.workflows，字典键为二元组 (id, version)。"""
    reg: Dict[WorkflowKey, Dict[str, Any]] = {}

    def walk(deps: Any) -> None:
        if not isinstance(deps, dict):
            return
        for wf in deps.get("workflows") or []:
            if not isinstance(wf, dict):
                continue
            # 支持 workflow_id 和 id 两种字段
            wid = str(wf.get("workflow_id") or wf.get("id") or "").strip()
            if not wid:
                continue
            # 支持 workflow_version 和 version 两种字段
            wver = str(wf.get("workflow_version") or wf.get("version") or "draft").strip() or "draft"
            key = (wid, wver)
            if key not in reg:
                reg[key] = wf
            walk(wf.get("dependencies"))

    walk(root.get("dependencies"))
    return reg


def _parse_runtime_userdata_api_keys() -> Dict[str, str]:
    """
    从 RUNTIME_USERDATA 环境变量中解析 API keys

    支持格式：
    1. JSON 字符串：'{"api_keys": {"qwen":"sk-abcdefg", "openai":"sk-123456"}}'
    2. Python 字典字符串："{'api_keys': {'qwen':'sk-abcdefg'}}"

    Returns:
        API keys 字典，如 {"qwen": "sk-abcdefg", "openai": "sk-123456"}
    """
    import json
    userdata_str = os.environ.get("RUNTIME_USERDATA")

    if not userdata_str:
        return {}

    try:
        userdata = json.loads(userdata_str)
        if isinstance(userdata, dict) and "api_keys" in userdata:
            api_keys = userdata["api_keys"]
            if isinstance(api_keys, dict):
                return api_keys
    except (json.JSONDecodeError, TypeError):
        try:
            normalized_str = userdata_str.replace("'", '"')
            userdata = json.loads(normalized_str)
            if isinstance(userdata, dict) and "api_keys" in userdata:
                api_keys = userdata["api_keys"]
                if isinstance(api_keys, dict):
                    return api_keys
        except Exception as e:
            logger.debug(f"Failed to parse RUNTIME_USERDATA: {e}")
            pass

    return {}


def _inject_llm_into_component(comp: Dict[str, Any], runtime_api_keys: Dict[str, str]) -> None:
    if not isinstance(comp, dict):
        return
    t = comp.get("type")
    try:
        ti = int(t) if t is not None else -1
    except (TypeError, ValueError):
        ti = -1
    if ti == int(studio_dsl.ComponentType.COMPONENT_TYPE_LOOP):
        cfg = comp.get("configs") or {}
        lb = cfg.get("loop_body") or {}
        for c in lb.get("components") or []:
            _inject_llm_into_component(c, runtime_api_keys)
        return
    if ti not in (
        int(studio_dsl.ComponentType.COMPONENT_TYPE_LLM),
        int(studio_dsl.ComponentType.COMPONENT_TYPE_INTENT),
        int(studio_dsl.ComponentType.COMPONENT_TYPE_QUESTION),
    ):
        return

    cfg = comp.get("configs") or {}
    model = cfg.get("model")
    if not isinstance(model, dict):
        return
    mcc = model.get("model_client_config") or {}
    if not isinstance(mcc, dict):
        return
    
    base_url = str(mcc.get("api_base") or "").strip()
    json_val = str(mcc.get("api_key") or "").strip()
    
    api_key = json_val
    
    if not api_key and base_url:
        env_key = _llm_api_key_env_var_name(base_url)
        env_val = (os.environ.get(env_key) or "").strip()
        if env_val:
            api_key = env_val
    
    if not api_key and runtime_api_keys:
        model_name = str(model.get("model_name") or mcc.get("model_name") or "").strip()
        if model_name:
            api_key = _match_api_key_from_runtime_keys(model_name, runtime_api_keys)

    if api_key:
        mcc["api_key"] = api_key

    model["model_client_config"] = mcc
    cfg["model"] = model
    comp["configs"] = cfg


def _match_api_key_from_runtime_keys(model_name: str, runtime_api_keys: Dict[str, str]) -> str:
    """根据模型名称匹配 runtime_api_keys 中的 API key。

    匹配规则（按优先级）：
    1. 完全匹配（不区分大小写）
    2. key_name 包含在 model_name 中
    3. model_name 包含在 key_name 中
    4. key_name 匹配 model_name 的最后一部分（如 "qwen" 匹配 "qwen/max"）
    """
    model_name_lower = model_name.lower()
    for key_name, key_value in runtime_api_keys.items():
        key_name_lower = key_name.lower()
        if _is_model_key_match(key_name_lower, model_name_lower):
            return str(key_value).strip()
    return ""


def _is_model_key_match(key_name_lower: str, model_name_lower: str) -> bool:
    """检查 key_name 是否与 model_name 匹配。"""
    if key_name_lower == model_name_lower:
        return True
    if key_name_lower in model_name_lower:
        return True
    if model_name_lower in key_name_lower:
        return True
    if key_name_lower == model_name_lower.split("/")[-1]:
        return True
    return False


def _llm_api_key_env_var_name(base_url: str) -> str:
    import re
    from urllib.parse import urlparse
    
    url = (base_url or "").strip().strip('"').strip("'")
    if not url:
        return "LLM_KEY__<SLUG_FROM_BASE_URL>"
    parsed = urlparse(url)
    host = (parsed.hostname or "").replace(".", "_")
    path = (parsed.path or "").strip("/").replace("/", "_")
    parts = [part for part in (host, path) if part]
    raw = "_".join(parts) if parts else url
    slug = re.sub(r"[^A-Za-z0-9]+", "_", raw).strip("_").upper()
    if not slug:
        return "LLM_KEY__<SLUG_FROM_BASE_URL>"
    return f"LLM_KEY__{slug}"


def inject_llm_api_keys_into_workflow_tree(wf: Dict[str, Any]) -> None:
    """按 api_base 解析 LLM_KEY__*：仅当对应环境变量非空时覆盖 api_key。
    
    同时支持从 RUNTIME_USERDATA 环境变量中的 api_keys 字段读取 API key。
    """
    runtime_api_keys = _parse_runtime_userdata_api_keys()
    for comp in wf.get("components") or []:
        if isinstance(comp, dict):
            _inject_llm_into_component(comp, runtime_api_keys)


def _scalar_endpoint_from_config(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else ""
    return value


def _normalize_connection_endpoints_in_workflow_dict(wf: Dict[str, Any]) -> None:
    conns = wf.get("connections")
    if isinstance(conns, list):
        for c in conns:
            if not isinstance(c, dict):
                continue
            c["source"] = _scalar_endpoint_from_config(c.get("source"))
            c["target"] = _scalar_endpoint_from_config(c.get("target"))
    for comp in wf.get("components") or []:
        if not isinstance(comp, dict):
            continue
        try:
            ti = int(comp.get("type")) if comp.get("type") is not None else -1
        except (TypeError, ValueError):
            ti = -1
        if ti != int(studio_dsl.ComponentType.COMPONENT_TYPE_LOOP):
            continue
        cfg = comp.get("configs") or {}
        lb = cfg.get("loop_body")
        if isinstance(lb, dict):
            _normalize_connection_endpoints_in_workflow_dict(lb)


def workflow_dict_to_dl_workflow(wf: Dict[str, Any]) -> studio_dsl.Workflow:
    stripped = strip_dependencies(wf)
    _normalize_connection_endpoints_in_workflow_dict(stripped)
    inject_llm_api_keys_into_workflow_tree(stripped)
    return studio_dsl.Workflow.model_validate(stripped)


class DependencyWorkflowLoader(IWorkflowLoader):
    """按 id/version 在 dependencies 扁平表中查找子工作流并递归 compile。"""

    def __init__(
        self,
        registry: Dict[WorkflowKey, Dict[str, Any]],
        space_id: str,
        current_user: Dict[str, Any],
    ) -> None:
        self._registry = registry
        self._space_id = space_id
        self._current_user = current_user
        self._cache: Dict[WorkflowKey, InvokableWorkflow] = {}
        self._compiling: set[WorkflowKey] = set()

    def _resolve(self, wid: str, version: str) -> tuple[Dict[str, Any], WorkflowKey]:
        vid = str(wid or "").strip()
        ver = str(version or "").strip() or "draft"
        key: WorkflowKey = (vid, ver)
        d = self._registry.get(key)
        if d is None and ver != "draft":
            key = (vid, "draft")
            d = self._registry.get(key)
        if d is None:
            raise ValueError(
                f"dependencies.workflows 中未找到子工作流 id={wid!r} version={version!r}，"
                f"已注册 id 列表: {[k[0] for k in self._registry]}"
            )
        return d, key

    async def get_compiled_workflow(
        self,
        context: Context,
        workflow_id: str,
        version: str,
        space_id: str,
        current_user: Dict[str, Any],
    ) -> InvokableWorkflow:
        wf_dict, cache_key = self._resolve(workflow_id, version)
        if cache_key in self._cache:
            return self._cache[cache_key]
        if cache_key in self._compiling:
            raise ValueError(f"子工作流循环依赖: id={cache_key[0]!r} version={cache_key[1]!r}")
        self._compiling.add(cache_key)
        try:
            dl = workflow_dict_to_dl_workflow(wf_dict)
            user = current_user if current_user is not None else self._current_user
            executor = ExecutorWorkflow(dl, space_id, user)
            compiled = await executor.compile(context, loader=self)
            self._cache[cache_key] = compiled
            return compiled
        finally:
            self._compiling.discard(cache_key)


def unwrap_workflow_document(ir: Dict[str, Any]) -> Dict[str, Any]:
    """若导出为外层 workflow 键包裹的内层 DSL，则合并 dependencies 后返回内层字典。"""
    if isinstance(ir.get("components"), list) and isinstance(ir.get("connections"), list):
        return ir
    w = ir.get("workflow")
    if isinstance(w, dict) and isinstance(w.get("components"), list):
        merged = dict(w)
        if isinstance(ir.get("dependencies"), dict) and "dependencies" not in w:
            merged["dependencies"] = ir["dependencies"]
        return merged
    return ir


def looks_like_dsl_workflow_export(ir: Dict[str, Any]) -> bool:
    ir = unwrap_workflow_document(ir)
    return isinstance(ir.get("components"), list) and isinstance(ir.get("connections"), list)
