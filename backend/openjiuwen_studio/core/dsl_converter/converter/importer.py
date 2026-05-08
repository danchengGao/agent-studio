#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

"""
Workflow Importer

Orchestrates the workflow import process:
1. Detect format
2. Convert to OpenJiuwen format
3. Validate
4. Save to database
5. Optionally publish
"""

import json
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional

from openjiuwen.core.common.logging import logger
from fastapi import status

from openjiuwen_studio.core.dsl_converter.converter.detector import WorkflowDetector, WorkflowFormat
from openjiuwen_studio.core.dsl_converter.converter.converter import ConverterFactory
from openjiuwen_studio.core.dsl_converter.converter.validator import WorkflowValidator
from openjiuwen_studio.schemas.workflow import WorkflowCreate, WorkflowSave, WorkflowPublish
import openjiuwen_studio.core.manager.workflow as workflow_mgr
from openjiuwen_studio.core.dsl_converter.converter.reporter import Reporter
from openjiuwen_studio.core.manager.repositories.plugin_repository import plugin_repository
from openjiuwen_studio.core.manager.repositories.tool_repository import tool_repository
import openjiuwen_studio.core.manager.plugin as plugin_mgr
from openjiuwen_studio.schemas.plugin import (
    PluginCreate, PluginApiInfoCreate, PluginToolParam,
    PluginType, PluginApiMethod, ParamType, ParamSendMethod,
)


@dataclass
class ImportOptions:
    """Options for workflow import"""
    validate_strict: bool = False     # Compile + validate
    auto_fix: bool = True            # Try to fix issues (not implemented yet)


@dataclass
class ImportResult:
    """Result of workflow import"""
    success: bool
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class WorkflowImporter:
    """Orchestrates workflow import process"""

    def __init__(self):
        self.detector = WorkflowDetector()
        self.validator = WorkflowValidator()       
        self.reporter = Reporter()   

    async def import_workflow(
        self,
        json_data: Dict[str, Any],
        space_id: str,
        current_user: Dict[str, Any],
        options: Optional[ImportOptions] = None
    ) -> ImportResult:
        """
        Import workflow from JSON data.

        Complete workflow import process:
        1. Detect format (OpenJiuwen native, n8n, etc.)
        2. Convert to OpenJiuwen format:
           - Generate new workflow_id (GUID) to avoid collisions
           - Regenerate all canvas node IDs
           - Update timestamps to current time
           - Clear version fields (creates as draft)
        3. Validate workflow structure and optionally compile/execute test
        4. Create workflow in database via manager:
           - Assigns fresh workflow_id and auto-incrementing id
           - Appends " (imported)" to workflow name to distinguish from original
           - Sets proper permissions and space_id
        5. Save canvas schema with regenerated node IDs
        6. (Publishing removed - always imports as draft only)

        Important: The imported workflow will have:
        - A NEW workflow_id (different from the exported workflow)
        - A NEW auto-incrementing id field
        - Name with " (imported)" suffix (e.g., "My Workflow (imported)")
        - Current timestamps
        - No version history (starts as draft)

        Args:
            json_data: Workflow JSON data
            space_id: Target space ID
            current_user: Current user info
            options: Import options (validate_strict)

        Returns:
            ImportResult with import status, new workflow_id, name, warnings, and metadata
        """
        
        # initialize reporter
        self.reporter.add_step("Starting import workflow", True)

        if options is None:
            options = ImportOptions()

        all_warnings = []
        all_errors = []

        # Step 1: Detect format
        try:
            format_type = self.detector.detect_format(json_data)
            logger.info(f"Detected workflow format: {format_type}")
            self.reporter.add_step(f"Detect workflow format {format_type}", True)            
           
            if format_type == WorkflowFormat.UNSUPPORTED:
                error_msg = "Unsupported workflow format. Supported formats: OpenJiuwen native, n8n"
                self.reporter.add_step("Validate format support", False, error_msg)
                return ImportResult(
                    success=False,                    
                    errors=self.reporter.log_trace()
                )
            
            self.reporter.add_step("Validate format support", True)

        except Exception as e:
            error_msg = f"Format detection failed: {e}"
            logger.error(error_msg)
            self.reporter.add_step("Detect workflow format", False, error_msg)
            return ImportResult(
                success=False,
                errors=self.reporter.log_trace()
            )

        # Step 2: Convert to OpenJiuwen format
        try:
            converter = ConverterFactory.create(format_type)
            conversion_result = converter.convert(json_data)

            workflow_data = conversion_result.workflow_data
            all_warnings.extend(conversion_result.warnings)

            # Set space_id
            workflow_data["space_id"] = space_id

            logger.info(f"Conversion completed: {conversion_result.metadata}")
            self.reporter.add_step("Convert to OpenJiuwen format", True)

        except Exception as e:
            error_msg = f"Conversion failed: {e}"
            logger.error(error_msg)
            self.reporter.add_step("Convert to OpenJiuwen format", False, error_msg)
            return ImportResult(
                success=False,
                errors=self.reporter.log_trace(),
                warnings=all_warnings
            )

        # Step 2.5: Resolve marketplace plugin references to real DB IDs
        try:
            raw_schema = workflow_data.get("schema", "{}")
            schema_dict = json.loads(raw_schema) if isinstance(raw_schema, str) else raw_schema
            resolve_warnings = self._resolve_marketplace_plugins(schema_dict, space_id, current_user)
            # Write back the (potentially patched) schema as a JSON string
            workflow_data["schema"] = json.dumps(schema_dict) if isinstance(raw_schema, str) else schema_dict
            all_warnings.extend(resolve_warnings)
            if resolve_warnings:
                logger.info(f"Marketplace plugin resolution warnings: {resolve_warnings}")
            self.reporter.add_step("Resolve marketplace plugin references", True)
        except Exception as e:
            # Resolution failure is non-fatal — workflow still imports with placeholder IDs
            warn_msg = f"Marketplace plugin resolution skipped: {e}"
            logger.warning(warn_msg)
            all_warnings.append(warn_msg)
            self.reporter.add_step("Resolve marketplace plugin references", True, warn_msg)

        # Step 3: Validate
        try:
            validation_result = await self.validator.validate(
                workflow_data,
                space_id,
                current_user,
                strict=options.validate_strict
            )

            all_warnings.extend(validation_result.warnings)

            if not validation_result.is_valid:
                error_msg = f"Validation failed: {', '.join(validation_result.errors)}"
                logger.error(error_msg)
                self.reporter.add_step("Validate workflow structure", False, error_msg)
                return ImportResult(
                    success=False,
                    errors=self.reporter.log_trace(),
                    warnings=all_warnings,
                    workflow_id=workflow_data.get("workflow_id"),
                    workflow_name=workflow_data.get("name")
                )

            logger.info("Validation passed")
            self.reporter.add_step("Validate workflow structure", True)

        except Exception as e:
            error_msg = f"Validation error: {e}"
            logger.error(error_msg)
            self.reporter.add_step("Validate workflow structure", False, error_msg)
            return ImportResult(
                success=False,
                errors=self.reporter.log_trace(),
                warnings=all_warnings
            )

        # Step 4: Create workflow via manager (gets permissions, tags, etc.)
        # Add " (imported)" suffix to distinguish from original
        try:
            original_name = workflow_data["name"]
            imported_name = f"{original_name} (imported)"

            create_req = WorkflowCreate(
                name=imported_name,
                desc=workflow_data.get("desc", ""),
                space_id=space_id,
                icon_uri=workflow_data.get("icon_uri")
            )

            create_result = workflow_mgr.workflow_create(create_req, current_user)

            if create_result.code != status.HTTP_200_OK:
                error_msg = f"Workflow creation failed: {create_result.message}"
                logger.error(error_msg)
                self.reporter.add_step("Create workflow", False, error_msg)
                return ImportResult(
                    success=False,
                    errors=self.reporter.log_trace(),
                    warnings=all_warnings
                )

            workflow_id = create_result.data['workflow']["workflow_id"]
            logger.info(f"Workflow created via manager: {workflow_id}")
            self.reporter.add_step("Create workflow in database", True)

        except Exception as e:
            error_msg = f"Failed to create workflow: {e}"
            logger.error(error_msg)
            self.reporter.add_step("Create workflow", False, error_msg)
            return ImportResult(
                success=False,
                errors=self.reporter.log_trace(),
                warnings=all_warnings
            )

        # Step 5: Save the imported canvas schema (replacing default)
        try:
            save_req = WorkflowSave(
                workflow_id=workflow_id,
                space_id=space_id,
                schema=workflow_data["schema"]  # Converted Canvas JSON string
            )

            save_result = workflow_mgr.workflow_canvas_save(save_req, current_user)
           
            if save_result.code != status.HTTP_200_OK:
                error_msg = f"Save workflow Canvas failed: {save_result.message}"
                logger.error(error_msg)
                self.reporter.add_step("Save workflow Canvas", False, error_msg)
                return ImportResult(
                    success=False,
                    errors=self.reporter.log_trace(),
                    warnings=all_warnings,
                    workflow_id=workflow_id
                )

            logger.info(f"Save workflow Canvas: {workflow_id}")
            self.reporter.add_step(f"Save workflow Canvas: {workflow_id}", True)

        except Exception as e:
            error_msg = f"Failed to save canvas: {e}"
            logger.error(error_msg)
            self.reporter.add_step("Save canvas schema", False, error_msg)
            return ImportResult(
                success=False,
                errors=self.reporter.log_trace(),
                warnings=all_warnings,
                workflow_id=workflow_id
            )

        # Success!
        self.reporter.add_step("Import workflow completed successfully", True)

        return ImportResult(
            success=True,
            workflow_id=workflow_id,
            workflow_name=imported_name,
            warnings=all_warnings,
            metadata={
                **conversion_result.metadata,
                "original_name": original_name,
                "saved_to_db": True,
                "published": False
            }
        )

    # -------------------------------------------------------------------------
    # Marketplace plugin resolution
    # -------------------------------------------------------------------------

    def _resolve_marketplace_plugins(
        self,
        schema: Dict[str, Any],
        space_id: str,
        current_user: Optional[Dict[str, Any]] = None,
    ) -> List[str]:
        """
        Scan every Plugin node in the converted schema for marketplace metadata
        (_marketplace_plugin_id / _marketplace_tool_name) and either:

        - Plugin installed  → replace placeholder UUIDs with real DB IDs
        - Plugin not installed → downgrade node to HTTP Request so it can execute
          immediately (auth params may need to be filled in manually)

        The schema dict is modified in-place.
        Returns a list of human-readable warning strings.
        """
        warnings: List[str] = []
        nodes = schema.get("nodes", [])
        if not nodes:
            return warnings

        # Collect marketplace nodes: plugin_name → list of (node, pluginParam)
        needed: Dict[str, List[tuple]] = {}
        for node in nodes:
            plugin_param = (
                node.get("data", {})
                    .get("inputs", {})
                    .get("pluginParam", {})
            )
            mp_name = plugin_param.get("_marketplace_plugin_name")
            if mp_name:
                needed.setdefault(mp_name, []).append((node, plugin_param))

        if not needed:
            return warnings

        # Fetch all installed plugins for the space (single DB query)
        list_result = plugin_repository.plugin_list({"space_id": space_id, "size": 1000})
        response_data = list_result.get("data", {}) or {}
        installed_plugins: List[Dict[str, Any]] = (
            response_data.get("plugin_infos", []) if isinstance(response_data, dict) else response_data
        ) or []

        name_to_db_plugin: Dict[str, Dict[str, Any]] = {}
        for db_plugin in installed_plugins:
            pname = (db_plugin.get("name") or "").strip().lower()
            if pname and pname not in name_to_db_plugin:
                name_to_db_plugin[pname] = db_plugin

        for mp_plugin_name, node_pairs in needed.items():
            db_plugin = name_to_db_plugin.get(mp_plugin_name.lower())

            # ── Plugin NOT installed → try auto-install, else HTTP fallback ──
            if not db_plugin:
                mp_plugin_id = node_pairs[0][1].get("_marketplace_plugin_id", "") if node_pairs else ""
                auto_installed = False

                if current_user and mp_plugin_id:
                    try:
                        installed_plugin_id, tool_name_to_id, tool_name_to_params = \
                            self._auto_install_marketplace_plugin(mp_plugin_id, space_id, current_user)
                        if installed_plugin_id:
                            # Resolve UUIDs using freshly installed tool IDs
                            for node, plugin_param in node_pairs:
                                mp_tool_name = plugin_param.get("_marketplace_tool_name", "")
                                real_tool_id = tool_name_to_id.get(mp_tool_name.lower())
                                if real_tool_id:
                                    plugin_param["pluginID"] = installed_plugin_id
                                    plugin_param["toolID"] = real_tool_id
                                    logger.info(
                                        f"Auto-installed and resolved '{mp_plugin_name}' / "
                                        f"'{mp_tool_name}' → pluginID={installed_plugin_id}, "
                                        f"toolID={real_tool_id}"
                                    )
                                    # Backfill inputParameters with all tool schema params
                                    param_names = tool_name_to_params.get(mp_tool_name.lower(), [])
                                    input_params = (
                                        node.get("data", {})
                                            .get("inputs", {})
                                            .get("inputParameters", {})
                                    )
                                    for pname in param_names:
                                        if pname and pname not in input_params:
                                            input_params[pname] = {
                                                "type": "constant",
                                                "content": "",
                                                "schema": {"type": "string"},
                                            }
                                else:
                                    self._downgrade_to_http_request(node, plugin_param)
                            auto_installed = True
                            warnings.append(
                                f"Plugin '{mp_plugin_name}' was not installed — "
                                f"automatically installed from the Marketplace."
                            )
                    except Exception as e:
                        logger.warning(f"Auto-install of '{mp_plugin_name}' failed: {e}")

                if not auto_installed:
                    for node, plugin_param in node_pairs:
                        node_title = node.get("data", {}).get("title", "?")
                        tool_name = plugin_param.get("_marketplace_tool_name", "?")
                        self._downgrade_to_http_request(node, plugin_param)
                        warnings.append(
                            f"Node '{node_title}' (tool: '{tool_name}'): plugin "
                            f"'{mp_plugin_name}' is not installed — converted to HTTP "
                            f"Request node. Install the plugin from the Marketplace and "
                            f"re-import to get full plugin integration, or add "
                            f"authentication to the HTTP Request node manually."
                        )
                continue

            db_plugin_id = db_plugin.get("plugin_id") or db_plugin.get("data", {}).get("plugin_id")
            if not db_plugin_id:
                for node, plugin_param in node_pairs:
                    self._downgrade_to_http_request(node, plugin_param)
                warnings.append(
                    f"Plugin '{mp_plugin_name}' found in DB but has no plugin_id — "
                    f"converted affected nodes to HTTP Request."
                )
                continue

            # ── Plugin IS installed → resolve UUIDs ───────────────────────────
            _, db_tools = plugin_repository.plugin_get({"plugin_id": db_plugin_id, "space_id": space_id})

            name_to_tool: Dict[str, Dict[str, Any]] = {}
            for t in (db_tools or []):
                tname = (t.get("name") or "").strip().lower()
                if tname:
                    name_to_tool[tname] = t

            for node, plugin_param in node_pairs:
                mp_tool_name = plugin_param.get("_marketplace_tool_name", "")
                db_tool = name_to_tool.get(mp_tool_name.lower())
                if db_tool:
                    plugin_param["pluginID"] = db_plugin_id
                    plugin_param["toolID"] = db_tool.get("tool_id", plugin_param["toolID"])
                    logger.info(
                        f"Resolved '{mp_plugin_name}' / '{mp_tool_name}' → "
                        f"pluginID={db_plugin_id}, toolID={plugin_param['toolID']}"
                    )
                    # Backfill inputParameters with ALL tool schema params so the GUI
                    # shows every parameter, not just the ones set in the n8n workflow.
                    input_params = node.get("data", {}).get("inputs", {}).get("inputParameters", {})
                    for schema_param in (db_tool.get("input_parameters") or []):
                        pname = schema_param.get("name")
                        if pname and pname not in input_params:
                            input_params[pname] = {
                                "type": "constant",
                                "content": "",
                                "schema": {"type": "string"},
                            }
                else:
                    # Tool not found even though plugin is installed — fall back
                    node_title = node.get("data", {}).get("title", "?")
                    self._downgrade_to_http_request(node, plugin_param)
                    warnings.append(
                        f"Node '{node_title}': plugin '{mp_plugin_name}' is installed "
                        f"but tool '{mp_tool_name}' was not found — converted to HTTP "
                        f"Request node. The plugin may need to be reinstalled."
                    )

        return warnings

    @staticmethod
    def _downgrade_to_http_request(node: Dict[str, Any], plugin_param: Dict[str, Any]) -> None:
        """
        Convert a marketplace Plugin node to an HTTP Request node in-place.

        Uses the metadata stored in pluginParam by _convert_marketplace_node():
          _marketplace_api_prefix  – base URL  (e.g. "https://api.nasa.gov")
          url                      – API path   (e.g. "/DONKI/FLR")
          method                   – HTTP verb  (e.g. "GET")
          params                   – extracted query params dict

        The node type is changed from 19 (Plugin) to 20 (HTTP Request) and the
        inputs are rebuilt to match the HTTP Request component contract.
        Auth is left blank — the user must fill it in manually.
        """
        api_prefix = plugin_param.get("_marketplace_api_prefix", "")
        path = plugin_param.get("url", "")
        method = plugin_param.get("method", "GET")
        query_params = plugin_param.get("params", {}) or {}

        full_url = (api_prefix.rstrip("/") + "/" + path.lstrip("/")) if path else api_prefix

        def _const(content: Any, schema_type: str = "string") -> Dict[str, Any]:
            return {"type": "constant", "content": content, "schema": {"type": schema_type}}

        auth_config = {
            "type": "none",
            "username": "", "password": "", "token": "",
            "api_key": "", "api_key_location": "header", "api_key_param_name": "X-API-Key"
        }

        input_parameters: Dict[str, Any] = {
            "url": _const(full_url, "string"),
            "method": _const(method, "string"),
            "headers": _const({}, "object"),
            "query": _const(query_params, "object"),
            "body": _const({}, "object"),
            "auth": _const(auth_config, "object"),
        }

        # queryParams values must be BaseValue dicts, not plain strings
        query_params_wrapped = {
            k: {"type": "constant", "content": v, "schema": {"type": "string"}}
            for k, v in query_params.items()
        }

        http_request_param: Dict[str, Any] = {
            "url": {"type": "constant", "content": full_url, "schema": {"type": "string"}},
            "method": method,
            "headers": {},
            "queryParams": query_params_wrapped,
            "body": {"contentType": "application/json", "content": {}},
            "auth": {
                "authType": "none",
                "username": "", "password": "", "token": "",
                "apiKey": "", "apiKeyLocation": "header", "apiKeyParamName": "X-API-Key"
            },
            "response": {
                "responseFormat": "auto",
                "successStatusCodes": [200, 201, 202, 204],
                "failureStatusCodes": [],
                "responseMode": "full",
                "dataProperty": None
            },
            "advanced": {
                "followRedirects": True,
                "ignoreSslIssues": True,
                "proxyUrl": None,
                "timeout": 60,
                "retry": {
                    "enabled": False, "maxRetries": 3,
                    "retryOnStatusCodes": [429, 500, 502, 503, 504],
                    "retryDelayMs": 1000, "backoffType": "exponential"
                },
                "rateLimit": {"enabled": False, "requestsPerUnit": 10, "unit": "minute"}
            }
        }

        # Preserve raw n8n debug fields if present
        existing_inputs = node.get("data", {}).get("inputs", {})

        # Mutate the node in-place
        node["type"] = "20"  # ComponentType.COMPONENT_TYPE_HTTP_REQUEST
        node["data"]["inputs"] = {
            "method": {"type": "constant", "content": method},
            "inputParameters": input_parameters,
            "httpRequestParam": http_request_param,
            "_n8n_type": existing_inputs.get("_n8n_type", ""),
            "_n8n_params": existing_inputs.get("_n8n_params", {}),
        }
        node["data"]["outputs"] = {
            "type": "object",
            "properties": {
                "error_code": {"type": "integer", "description": "Error code (0 for success)", "extra": {"index": 1}},
                "error_msg": {"type": "string", "description": "Error message", "extra": {"index": 2}},
                "data": {"type": "object", "description": "Response data (JSON object)", "extra": {"index": 3}}
            },
            "required": ["error_code", "error_msg", "data"]
        }
        node["data"]["exceptionConfig"] = {
            "retryTimes": 0, "timeoutSeconds": 60, "processType": "break",
            "executeStep": {"defaultStep": "0", "errorStep": "1"}
        }

    # -------------------------------------------------------------------------
    # Marketplace plugin auto-install
    # -------------------------------------------------------------------------

    @staticmethod
    def _auto_install_marketplace_plugin(
        marketplace_plugin_id: str,
        space_id: str,
        current_user: Dict[str, Any],
    ):
        """
        Install a marketplace plugin into the given space by reading its JSON
        definition from the marketplace catalog and calling plugin_create /
        plugin_create_api for each tool.

        Returns a 3-tuple:
            (plugin_id: str,
             tool_name_to_id: Dict[str, str],      # tool_name.lower() → tool_id
             tool_name_to_params: Dict[str, List[str]])  # tool_name.lower() → [param_names]

        Returns ("", {}, {}) if the plugin is not found or creation fails.
        """
        # -- Load marketplace catalog ------------------------------------------
        catalog = plugin_mgr.load_plugins_from_directory()
        if not catalog:
            logger.warning(
                f"_auto_install_marketplace_plugin: could not load marketplace catalog"
            )
            return "", {}, {}

        plugin_data = catalog.get("plugins", {}).get(marketplace_plugin_id)
        if not plugin_data:
            logger.warning(
                f"_auto_install_marketplace_plugin: "
                f"marketplace plugin '{marketplace_plugin_id}' not found in catalog"
            )
            return "", {}, {}

        # -- HTTP method string → enum -----------------------------------------
        _method_map = {
            "GET": PluginApiMethod.PLUGIN_API_METHOD_GET,
            "POST": PluginApiMethod.PLUGIN_API_METHOD_POST,
            "PUT": PluginApiMethod.PLUGIN_API_METHOD_PUT,
            "DELETE": PluginApiMethod.PLUGIN_API_METHOD_DELETE,
            "PATCH": PluginApiMethod.PLUGIN_API_METHOD_PATCH,
        }

        # -- Create the plugin container --------------------------------------
        create_req = PluginCreate(
            name=plugin_data.get("name", marketplace_plugin_id),
            desc=plugin_data.get("description", plugin_data.get("desc", "")),
            space_id=space_id,
            plugin_type=PluginType.PLUGIN_TYPE_CLOUD_API,
            url=plugin_data.get("api_prefix", plugin_data.get("url", "")),
            icon_uri=plugin_data.get("icon_uri", ""),
        )

        create_result = plugin_mgr.plugin_create(create_req, current_user)
        if create_result.code != 200:
            logger.warning(
                f"_auto_install_marketplace_plugin: plugin_create failed "
                f"for '{marketplace_plugin_id}': {create_result.message}"
            )
            return "", {}, {}

        plugin_id = create_result.data.plugin_id

        tool_name_to_id: Dict[str, str] = {}
        tool_name_to_params: Dict[str, List[str]] = {}

        # -- Create each tool -------------------------------------------------
        for tool in (plugin_data.get("tools") or []):
            tool_name = tool.get("name", "")
            if not tool_name:
                continue

            tool_path = tool.get("path", "")
            method_str = (tool.get("method") or "GET").upper()
            api_method = _method_map.get(method_str, PluginApiMethod.PLUGIN_API_METHOD_GET)

            # Convert request_params dict → List[PluginToolParam]
            raw_params = tool.get("request_params") or {}
            param_list: List[PluginToolParam] = []
            for pname, pcfg in raw_params.items():
                if not isinstance(pcfg, dict):
                    continue
                param_list.append(PluginToolParam(
                    name=pname,
                    desc=pcfg.get("desc", pcfg.get("description", "")),
                    type=pcfg.get("type", ParamType.PARAM_TYPE_STRING),
                    is_required=pcfg.get("is_required", False),
                    method=pcfg.get("method", ParamSendMethod.PARAM_SEND_METHOD_QUERY),
                    is_runtime=pcfg.get("is_runtime", True),
                    value=pcfg.get("value", ""),
                ))

            api_req = PluginApiInfoCreate(
                plugin_id=plugin_id,
                plugin_version="",
                space_id=space_id,
                plugin_type=PluginType.PLUGIN_TYPE_CLOUD_API,
                name=tool_name,
                desc=tool.get("description", tool.get("desc", "")),
                path=tool_path,
                method=api_method,
                request_params=param_list,
            )

            api_result = plugin_mgr.plugin_create_api(api_req, current_user)
            if api_result.code == 200:
                api_data = api_result.data
                tool_id = api_data.get("tool_id") if isinstance(api_data, dict) else str(api_data)
                key = tool_name.lower()
                tool_name_to_id[key] = tool_id
                tool_name_to_params[key] = [p.name for p in param_list]
                logger.info(
                    f"_auto_install_marketplace_plugin: "
                    f"installed tool '{tool_name}' → tool_id={tool_id}"
                )
            else:
                logger.warning(
                    f"_auto_install_marketplace_plugin: plugin_create_api failed "
                    f"for tool '{tool_name}': {api_result.message}"
                )

        logger.info(
            f"_auto_install_marketplace_plugin: "
            f"installed '{marketplace_plugin_id}' → plugin_id={plugin_id}, "
            f"{len(tool_name_to_id)} tools"
        )
        return plugin_id, tool_name_to_id, tool_name_to_params