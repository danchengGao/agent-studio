#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from typing import List, Dict, Any
from fastapi import status
from openjiuwen.core.common.logging import logger

from openjiuwen_studio.core.manager.repositories.workflow_tag_repository import workflow_tag_repository
from openjiuwen_studio.core.manager.tag import tag_get_or_create


def create_workflow_tags(workflow_id: str, space_id: str, tag_names: List[str], current_user: dict) -> List[
    Dict[str, Any]]:
    """Create workflow tags - get or create tags and associate with workflow.

    Args:
        workflow_id: Workflow ID
        space_id: Space ID
        tag_names: List of tag names to create
        current_user: Current user information

    Returns:
        List of created tag data
    """
    return _create_workflow_tags_with_version(workflow_id, space_id, tag_names, current_user, "draft")


def _create_workflow_tags_with_version(workflow_id: str, space_id: str, tag_names: List[str], current_user: dict,
                                       workflow_version: str = "draft") -> List[Dict[str, Any]]:
    """Internal: Create workflow tags with version support - get or create tags and associate with workflow.

    Args:
        workflow_id: Workflow ID
        space_id: Space ID
        tag_names: List of tag names to process
        current_user: Current user information
        workflow_version: Workflow version, defaults to "draft" for unpublished workflows

    Returns:
        List of processed tag data
    """
    processed_tags = []

    if not tag_names:
        return processed_tags

    try:
        for tag_name in tag_names:
            if not tag_name.strip():
                continue

            # Get or create tag
            tag_data = {
                "space_id": space_id,
                "tag_name": tag_name.strip(),
                "is_active": True
            }

            tag_result = tag_get_or_create(tag_data, current_user)

            if tag_result.code == status.HTTP_200_OK and tag_result.data:
                tag_info = tag_result.data["tag"]
                processed_tags.append(tag_info)

                # Associate tag with workflow
                tag_id = tag_info.get("primary_id")
                if tag_id:
                    association_data = {
                        "workflow_id": workflow_id,
                        "workflow_version": workflow_version,  # 保持与workflow表一致的版本处理
                        "tag_id": tag_id,
                        "space_id": space_id,
                        "create_time": tag_info.get("create_time")
                    }

                    # Check if association already exists and create if not
                    assoc_result = workflow_tag_repository.associate_tag(association_data)
                    if assoc_result.get("code") != status.HTTP_200_OK:
                        logger.warning(
                            f"Failed to create association for tag: {assoc_result.get('message')}")

        return processed_tags

    except Exception as e:
        logger.error(f"Error processing workflow tags: {e}")
        return processed_tags


def get_workflow_tags(workflow_id: str, space_id: str, workflow_version: str = "draft") -> List[Dict[str, Any]]:
    """Get all tags associated with a workflow.

    Args:
        workflow_id: Workflow ID
        space_id: Space ID
        workflow_version: Workflow version, defaults to "draft" for unpublished workflows

    Returns:
        List of associated tag data
    """
    try:
        query_body = {
            "workflow_id": workflow_id,
            "space_id": space_id,
            "workflow_version": workflow_version
        }

        result = workflow_tag_repository.get_workflow_tags(query_body)

        if result.get("code") == status.HTTP_200_OK and result.get("data"):
            return result.get("data")
        else:
            return []

    except Exception as e:
        logger.error(f"Error getting workflow tags: {e}")
        return []


def _remove_workflow_tags_by_ids(workflow_id: str, space_id: str, tag_ids: List[int]) -> bool:
    """Internal: Remove specific tag associations from a workflow by tag IDs.

    Args:
        workflow_id: Workflow ID
        space_id: Space ID
        tag_ids: List of tag IDs to remove

    Returns:
        True if successful, False otherwise
    """
    try:
        query_body = {
            "workflow_id": workflow_id,
            "space_id": space_id,
            "tag_ids": tag_ids
        }

        result = workflow_tag_repository.remove_tag_association(query_body)
        return result.code == status.HTTP_200_OK

    except Exception as e:
        logger.error(f"Error removing workflow tags: {type(e).__name__}")
        return False


def _remove_workflow_tags_by_names(workflow_id: str, space_id: str, tag_names: List[str],
                                   workflow_version: str = "draft") -> bool:
    """Internal: Remove specific tag associations from a workflow by tag names.

    Args:
        workflow_id: Workflow ID
        space_id: Space ID
        tag_names: List of tag names to remove
        workflow_version: Workflow version, defaults to "draft" for unpublished workflows

    Returns:
        True if successful, False otherwise
    """
    try:
        # Get existing tags to find their IDs
        existing_tags = get_workflow_tags(workflow_id, space_id, workflow_version)

        # Find tag IDs for the tag names to remove
        tag_ids_to_remove = []
        for tag in existing_tags:
            if tag['tag_name'] in tag_names:
                tag_ids_to_remove.append(tag['primary_id'])

        if tag_ids_to_remove:
            return _remove_workflow_tags_by_ids(workflow_id, space_id, tag_ids_to_remove)

        return True  # No tags to remove is considered success

    except Exception as e:
        logger.error(f"Error removing workflow tags by names: {e}")
        return False


def update_workflow_tags(workflow_id: str, space_id: str, tag_names: List[str], current_user: dict,
                         workflow_version: str = "draft") -> List[Dict[str, Any]]:
    """Update workflow tags using incremental approach - only add/remove changed tags.

    Args:
        workflow_id: Workflow ID
        space_id: Space ID
        tag_names: List of tag names to associate
        current_user: Current user information
        workflow_version: Workflow version, defaults to "draft" for unpublished workflows

    Returns:
        List of current tag data after update
    """
    try:
        # 检查tag数量限制
        max_tags_per_workflow = 3
        if len(tag_names) > max_tags_per_workflow:
            logger.warning(f"Tag count limit exceeded: {len(tag_names)} > {max_tags_per_workflow}")
            raise ValueError(f"每个workflow最多只能设置{max_tags_per_workflow}个tag，当前请求了{len(tag_names)}个")

        # 获取现有tags
        existing_tags = get_workflow_tags(workflow_id, space_id, workflow_version)
        existing_tag_names = {tag['tag_name'] for tag in existing_tags}
        new_tag_names_set = set(tag_names)

        # 计算差异
        tags_to_add = new_tag_names_set - existing_tag_names
        tags_to_remove = existing_tag_names - new_tag_names_set

        logger.info(f"Updating workflow tags incrementally:")
        logger.info(f"  Existing tags: {existing_tag_names}")
        logger.info(f"  New tags: {new_tag_names_set}")
        logger.info(f"  Tags to add: {tags_to_add}")
        logger.info(f"  Tags to remove: {tags_to_remove}")

        # 删除不需要的tags
        if tags_to_remove:
            remove_success = _remove_workflow_tags_by_names(workflow_id, space_id, list(tags_to_remove),
                                                            workflow_version)
            if not remove_success:
                logger.warning(f"Failed to remove some tags: {tags_to_remove}")

        # 添加新的tags
        if tags_to_add:
            added_tags = _create_workflow_tags_with_version(workflow_id, space_id, list(tags_to_add), current_user,
                                                            workflow_version)
            logger.info(f"Successfully added tags: {len(added_tags)}")
        else:
            added_tags = []

        # 返回更新后的完整tag列表
        updated_tags = get_workflow_tags(workflow_id, space_id, workflow_version)
        logger.info(f"Final tag count: {len(updated_tags)}")

        return updated_tags

    except ValueError as e:
        # 重新抛出数量限制错误，让上层处理
        raise e
    except Exception as e:
        logger.error(f"Error updating workflow tags incrementally: {e}")
        # 出错时返回当前状态，避免数据不一致
        return get_workflow_tags(workflow_id, space_id, workflow_version)
