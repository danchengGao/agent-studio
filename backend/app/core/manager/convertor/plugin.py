#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
import json
from typing import Dict, List, Any

from app.core.common import dsl
from app.core.manager.convertor.components.plugin import plugin_api_tool_convert, plugin_code_tool_convert, \
    plugin_type_mapping
from app.models.plugin import PluginBaseDBPd
from app.schemas.plugin import PluginType


def _plugin_api_tools_convert(url: str, api_info: Dict[str, Any]) -> List[Dict[str, Any]]:
    api_tools: List[Dict[str, Any]] = []
    convert_api = plugin_api_tool_convert(url, api_info)
    api_tools.append(convert_api)

    return api_tools


def _plugin_code_tools_convert(code_info: Dict[str, Any]) -> List[Dict[str, Any]]:
    code_tools: List[Dict[str, Any]] = []
    convert_api = plugin_code_tool_convert(code_info)
    code_tools.append(convert_api)

    return code_tools


def _plugin_tool_convert(plugin_info: PluginBaseDBPd, tool: Dict[str, Any]) -> List[Dict[str, Any]]:
    if plugin_info.plugin_type == PluginType.PLUGIN_TYPE_CLOUD_API:
        return _plugin_api_tools_convert(plugin_info.url, tool)
    else:
        return _plugin_code_tools_convert(tool)


def plugin_tool_convert(plugin_info, tool: Dict[str, Any]) -> List[Dict[str, Any]]:
    if plugin_info.plugin_type == PluginType.PLUGIN_TYPE_CLOUD_API:
        return _plugin_api_tools_convert(plugin_info.url, tool)
    else:
        return _plugin_code_tools_convert(tool)


def plugin_convert(plugin_info: PluginBaseDBPd, tool: Dict[str, Any]) -> dsl.Plugin:
    try:
        convert_tools = _plugin_tool_convert(plugin_info, tool)

        return dsl.Plugin(
            plugin_id=plugin_info.plugin_id,
            plugin_name=plugin_info.name,
            plugin_description=plugin_info.desc,
            plugin_type=plugin_type_mapping[plugin_info.plugin_type],
            tools=convert_tools,
            plugin_version=plugin_info.plugin_version,
        )
    except (json.JSONDecodeError, TypeError, AttributeError) as e:
        raise ValueError(f"Invalid plugin schema or input: {e}") from e
