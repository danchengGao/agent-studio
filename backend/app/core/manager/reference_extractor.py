#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

import json
from typing import List, Dict, Any, Optional
from fastapi import status

from openjiuwen.core.common.logging import logger
from app.schemas.common import ResponseModel


def extract_workflow_references(
        schema_str: str, space_id: str, workflow_id: str, referer_version: str = "draft"
    ) -> List[Dict[str, Any]]:
    """
    从workflow schema中提取引用关系

    Args:
        schema_str: workflow的schema JSON字符串
        space_id: 空间ID
        workflow_id: 当前workflow ID
        referer_version: 引用者版本（默认draft）

    Returns:
        引用关系字典列表，每个字典包含reference表的字段信息
    """
    references = []

    try:
        schema = json.loads(schema_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse workflow schema for {workflow_id}: {e}")
        return references

    nodes = schema.get("nodes", [])

    for node in nodes:
        node_data = node.get("data", {})

        # 1. 提取Sub-Workflow引用
        configs = node_data.get("configs", {})
        sub_workflow = configs.get("subWorkflow")

        if sub_workflow and isinstance(sub_workflow, dict):
            referenced_workflow_id = sub_workflow.get("workflowId")
            if referenced_workflow_id:
                reference = {
                    "space_id": space_id,
                    "referenced_type": "WORKFLOW",
                    "referenced_id": referenced_workflow_id,
                    "referenced_version": sub_workflow.get("workflowVersion", "draft"),
                    "referer_type": "WORKFLOW",
                    "referer_id": workflow_id,
                    "referer_version": referer_version
                }
                references.append(reference)
                logger.debug(f"Found workflow reference: {workflow_id} -> {referenced_workflow_id}")

        # 2. 提取Plugin/Tool引用
        inputs = node_data.get("inputs", {})
        plugin_param = inputs.get("pluginParam")

        if plugin_param and isinstance(plugin_param, dict):
            tool_id = plugin_param.get("toolID")
            if tool_id:
                reference = {
                    "space_id": space_id,
                    "referenced_type": "TOOL",
                    "referenced_id": tool_id,
                    "referenced_version": "draft",  # Tool目前没有版本概念
                    "referer_type": "WORKFLOW",
                    "referer_id": workflow_id,
                    "referer_version": referer_version
                }
                references.append(reference)
                logger.debug(f"Found tool reference: {workflow_id} -> {tool_id}")

            plugin_id = plugin_param.get("pluginID")
            if plugin_id:
                reference = {
                    "space_id": space_id,
                    "referenced_type": "PLUGIN",
                    "referenced_id": plugin_id,
                    "referenced_version": "draft",  # PLUGIN目前没有版本概念
                    "referer_type": "WORKFLOW",
                    "referer_id": workflow_id,
                    "referer_version": referer_version
                }
                references.append(reference)
                logger.debug(f"Found PLUGIN reference: {workflow_id} -> {plugin_id}")

    logger.info(f"Extracted {len(references)} references from workflow {workflow_id}")
    return references


def extract_agent_references(
    agent_data: Dict[str, Any], space_id: str, referer_version: str = "draft"
) -> List[Dict[str, Any]]:
    """
    从agent配置中提取引用关系

    Args:
        agent_data: agent配置数据
        space_id: 空间ID
        referer_version: 引用者版本（默认draft）

    Returns:
        引用关系字典列表
    """
    references = []

    if not isinstance(agent_data, dict):
        logger.error(f"Invalid agent_data type: {type(agent_data)}")
        return references

    agent_id = agent_data.get("agent_id")
    if not agent_id:
        logger.error("Missing agent_id in agent_data")
        return references

    # 1. 提取workflow引用
    workflows = agent_data.get("workflows", [])
    if workflows and isinstance(workflows, list):
        for workflow in workflows:
            if isinstance(workflow, dict):
                workflow_id = workflow.get("workflow_id")
                if workflow_id:
                    reference = {
                        "space_id": space_id,
                        "referenced_type": "WORKFLOW",
                        "referenced_id": workflow_id,
                        "referenced_version": workflow.get("workflow_version", "draft"),
                        "referer_type": "AGENT",
                        "referer_id": agent_id,
                        "referer_version": referer_version
                    }
                    references.append(reference)
                    logger.debug(f"Found agent workflow reference: {agent_id} -> {workflow_id}")

    # 3. 提取plugin引用
    plugins = agent_data.get("plugins", [])
    if plugins and isinstance(plugins, list):
        for plugin in plugins:
            if isinstance(plugin, dict):
                plugin_id = plugin.get("plugin_id")
                if plugin_id:
                    reference = {
                        "space_id": space_id,
                        "referenced_type": "PLUGIN",
                        "referenced_id": plugin_id,
                        "referenced_version": "draft",  # PLUGIN目前没有版本概念
                        "referer_type": "AGENT",
                        "referer_id": agent_id,
                        "referer_version": referer_version
                    }
                    references.append(reference)
                    logger.debug(f"Found agent plugin reference: {agent_id} -> {plugin_id}")

                tool_id = plugin.get("tool_id")
                if tool_id:
                    reference = {
                        "space_id": space_id,
                        "referenced_type": "TOOL",
                        "referenced_id": tool_id,
                        "referenced_version": "draft",  # TOOL目前没有版本概念
                        "referer_type": "AGENT",
                        "referer_id": agent_id,
                        "referer_version": referer_version
                    }
                    references.append(reference)
                    logger.debug(f"Found agent plugin reference: {agent_id} -> {plugin_id}")

    logger.info(f"Extracted {len(references)} references from agent {agent_id}")
    return references


def check_referenced_dependencies(
    reference_repository, space_id: str, referenced_type: str, referenced_id: str
) -> tuple[bool, str]:
    """
    检查是否被其他资源引用

    Args:
        reference_repository: reference_repository实例
        space_id: 空间ID
        referenced_type: 被引用的类型 (WORKFLOW/TOOL)
        referenced_id: 被引用的ID

    Returns:
        (can_delete: bool, message: str) - 是否可以删除及原因
    """
    try:
        result = reference_repository.reference_list_by_referenced(space_id, referenced_type, referenced_id)

        if result["code"] == status.HTTP_200_OK and result["data"] and len(result["data"]) > 0:
            references = result["data"]
            referrers = []

            for ref in references:
                referrer_info = f"{ref['referer_type']}({ref['referer_id']}"
                if ref.get('referer_version') and ref['referer_version'] != 'draft':
                    referrer_info += f":{ref['referer_version']}"
                referrer_info += ")"
                referrers.append(referrer_info)

            return False, f"Cannot delete: referenced by {', '.join(referrers)}"

        return True, ""

    except Exception as e:
        logger.error(f"Error checking dependencies for {referenced_type}:{referenced_id}: {e}")
        return False, f"Error checking dependencies: {str(e)}"