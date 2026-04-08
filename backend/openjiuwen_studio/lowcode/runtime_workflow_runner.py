#!/usr/bin/env python
# -*- coding: utf-8 -*-

from __future__ import annotations

import copy
import json
import logging
from typing import Any, Dict

from openjiuwen.core.workflow.workflow import Workflow as InvokableWorkflow

from openjiuwen_studio.core.executor.workflow.context import Context
from openjiuwen_studio.core.executor.workflow.workflow import Workflow as ExecutorWorkflow
from openjiuwen_studio.schemas.workflow import WorkflowBase

from .workflow_builder import (
    build_plugin_tool_config_map,
    extract_inputs_and_outputs_from_canvas,
    inject_api_keys_into_model_references,
    workflow_convert_for_export,
)
from .config_adapter import ConfigAdapter
from .workflow_dependency_loader import (
    DependencyWorkflowLoader,
    collect_workflow_registry,
    looks_like_dsl_workflow_export,
    unwrap_workflow_document,
    workflow_dict_to_dl_workflow,
)

logger = logging.getLogger(__name__)


class RuntimeWorkflowRunner:
    """Runtime-side workflow manager aligned with studio Agent executor semantics."""

    def __init__(
        self,
        export_config: Dict[str, Any],
        *,
        current_user: Dict[str, Any] | None = None,
        space_id: str = "default",
        plugin_mgr: Any = None,
    ) -> None:
        self._export_config = export_config or {}
        self._space_id = space_id
        self._current_user = current_user or {"user_id": "runtime", "space_id": space_id}
        self._plugin_mgr = plugin_mgr
        self._model_references = self._export_config.get("model_references", {})
        self._plugin_tool_configs = build_plugin_tool_config_map(
            self._export_config.get("dependencies", {}).get("plugins") or []
        )
        self._registry = collect_workflow_registry(self._export_config)

    def _resolve_workflow(self, workflow_id: str, version: str) -> Dict[str, Any]:
        version = str(version or "draft").strip() or "draft"
        workflow_id = str(workflow_id or "").strip()

        # 如果 workflow_id 已经包含了 version 后缀，分离它们
        suffix = f"_{version}"
        if workflow_id.endswith(suffix):
            workflow_id = workflow_id[:-len(suffix)]

        workflow = self._registry.get((workflow_id, version))
        if workflow is None and version != "draft":
            workflow = self._registry.get((workflow_id, "draft"))
        if workflow is None:
            raise ValueError(f"Workflow not found in export config: id={workflow_id}, version={version}")
        # Always hand out an isolated snapshot. Downstream workflow conversion mutates
        # nested schema/config structures, so reusing the registry object breaks
        # consecutive invocations of the same workflow in one agent request.
        return copy.deepcopy(workflow)

    @staticmethod
    def _disable_end_stream_output(canvas: Dict[str, Any]) -> Dict[str, Any]:
        """Agent runtime consumes workflow results as tool outputs, not as workflow UI streams.

        Leaving end-node `stream_output=true` forces openjiuwen workflow invoke() down the
        internal stream-actor path even for agent tool calls, which has proven flaky in the
        runtime deployment environment and can stall before the first frame is emitted.
        """
        if not isinstance(canvas, dict):
            return canvas

        nodes = canvas.get("nodes")
        if not isinstance(nodes, list):
            return canvas

        patched = False
        for node in nodes:
            if not isinstance(node, dict):
                continue
            if str(node.get("type")) != "2":
                continue
            data = node.get("data")
            if not isinstance(data, dict):
                continue
            inputs = data.get("inputs")
            if isinstance(inputs, dict) and inputs.get("streaming") is True:
                inputs["streaming"] = False
                patched = True

        if patched:
            logger.info("RuntimeWorkflowRunner disabled end-node stream_output for agent workflow execution")
        return canvas

    def _build_dl_workflow(self, workflow_dict: Dict[str, Any], *, space_id: str) -> Any:
        workflow_dict = copy.deepcopy(workflow_dict)
        source = unwrap_workflow_document(workflow_dict)
        if looks_like_dsl_workflow_export(source):
            return workflow_dict_to_dl_workflow(source)

        canvas_schema = workflow_dict.get("schema", {})
        if isinstance(canvas_schema, str):
            canvas = json.loads(canvas_schema or "{}")
        elif isinstance(canvas_schema, dict):
            canvas = copy.deepcopy(canvas_schema)
        else:
            canvas = {}

        canvas = self._disable_end_stream_output(canvas)

        input_parameters, output_parameters = extract_inputs_and_outputs_from_canvas(canvas)
        workflow_base = WorkflowBase(
            workflow_id=str(workflow_dict.get("workflow_id") or workflow_dict.get("id") or ""),
            space_id=space_id,
            workflow_version=str(workflow_dict.get("workflow_version") or workflow_dict.get("version") or "draft"),
            name=str(workflow_dict.get("workflow_name") or workflow_dict.get("name") or "Workflow"),
            desc=str(workflow_dict.get("description") or ""),
            schema=json.dumps(canvas, ensure_ascii=False),
            input_parameters=input_parameters,
            output_parameters=output_parameters,
        )
        processed_model_references = ConfigAdapter.preprocess_model_references(
            workflow_dict.get("schema", {}),
            inject_api_keys_into_model_references(self._model_references),
        )
        return workflow_convert_for_export(
            workflow_base,
            skip_validation=True,
            model_references=processed_model_references,
            plugin_tool_configs=self._plugin_tool_configs,
        )

    async def get_flow(
        self,
        workflow_id: str,
        version: str,
        space_id: str,
        current_user: Dict[str, Any],
    ) -> ExecutorWorkflow:
        logger.info(
            "RuntimeWorkflowRunner.get_flow start: workflow_id=%s, version=%s, space_id=%s",
            workflow_id,
            version,
            space_id or self._space_id,
        )
        workflow_dict = self._resolve_workflow(workflow_id, version)
        actual_space_id = space_id or self._space_id
        actual_user = current_user or self._current_user
        dl_workflow = self._build_dl_workflow(workflow_dict, space_id=actual_space_id)
        flow = ExecutorWorkflow(
            dl_workflow,
            actual_space_id,
            actual_user,
            plugin_mgr=self._plugin_mgr,
            workflow_mgr=self,
        )
        logger.info(
            "RuntimeWorkflowRunner.get_flow done: workflow_id=%s, version=%s, flow_name=%s",
            workflow_id,
            version,
            getattr(flow, "name", None),
        )
        return flow

    async def get_compiled_workflow(
        self,
        context: Context,
        workflow_id: str,
        version: str,
        space_id: str,
        current_user: Dict[str, Any],
    ) -> InvokableWorkflow:
        logger.info(
            "RuntimeWorkflowRunner.get_compiled_workflow start: workflow_id=%s, version=%s, space_id=%s",
            workflow_id,
            version,
            space_id or self._space_id,
        )
        workflow = await self.get_flow(workflow_id, version, space_id, current_user)
        actual_space_id = space_id or self._space_id
        actual_user = current_user or self._current_user
        loader = DependencyWorkflowLoader(
            self._registry,
            actual_space_id,
            actual_user,
        )
        compiled = await workflow.compile(context, loader=loader)
        logger.info(
            "RuntimeWorkflowRunner.get_compiled_workflow done: workflow_id=%s, version=%s",
            workflow_id,
            version,
        )
        return compiled
