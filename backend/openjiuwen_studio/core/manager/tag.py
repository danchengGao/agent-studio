#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

import time
from functools import wraps
from typing import Any, Dict, List, Optional

from fastapi import status
from pydantic import ValidationError

from openjiuwen_studio.core.manager.login_manager.space import check_user_space
from openjiuwen_studio.core.manager.repositories.tag_repository import tag_repository
from openjiuwen_studio.core.utils.exception import log_exception
from openjiuwen_studio.schemas.common import ResponseModel


def with_exception_handling(func):
    """Exception handling decorator for tag operations."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValidationError as e:
            log_exception(e)
            return ResponseModel(
                code=status.HTTP_400_BAD_REQUEST,
                message=f"Validation error: {type(e).__name__}"
            )
        except Exception as e:
            log_exception(e)
            return ResponseModel(
                code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"Internal server error: {type(e).__name__}"
            )

    return wrapper


@with_exception_handling
def tag_create(
        tag_data: Dict[str, Any],
        current_user: Dict[str, Any]
) -> ResponseModel:
    """Create a new tag.

    Args:
        tag_data: Tag creation data
        current_user: Current user information

    Returns:
        ResponseModel with created tag information
    """
    # Validate user has access to the space
    space_id = tag_data.get("space_id")
    if space_id:
        _ = check_user_space(space_id, current_user)

    # Set current user as creator if not specified
    tag_data.setdefault("create_user", current_user.get("user_id"))
    tag_data.setdefault("update_user", current_user.get("user_id"))

    result = tag_repository.tag_create(tag_data)
    return ResponseModel(**result)


@with_exception_handling
def tag_get(
        query_data: Dict[str, Any],
        current_user: Dict[str, Any]
) -> ResponseModel:
    """Get tag information.

    Args:
        query_data: Query parameters
        current_user: Current user information

    Returns:
        ResponseModel with tag information
    """
    # Validate user has access to the space if space_id is provided
    space_id = query_data.get("space_id")
    if space_id:
        _ = check_user_space(space_id, current_user)

    result = tag_repository.tag_get(query_data)
    return ResponseModel(**result)


@with_exception_handling
def tag_list(
        query_data: Dict[str, Any],
        current_user: Dict[str, Any]
) -> ResponseModel:
    """Get list of tags.

    Args:
        query_data: Query parameters (space_id required)
        current_user: Current user information

    Returns:
        ResponseModel with list of tags
    """
    # Validate user has access to the space
    space_id = query_data.get("space_id")
    if not space_id:
        return ResponseModel(
            code=status.HTTP_400_BAD_REQUEST,
            message="space_id is required"
        )

    _ = check_user_space(space_id, current_user)

    result = tag_repository.tag_list(query_data)
    return ResponseModel(**result)


@with_exception_handling
def tag_update(
        tag_data: Dict[str, Any],
        current_user: Dict[str, Any]
) -> ResponseModel:
    """Update tag information.

    Args:
        tag_data: Tag update data
        current_user: Current user information

    Returns:
        ResponseModel with updated tag information
    """
    # Validate user has access to the space
    space_id = tag_data.get("space_id")
    if space_id:
        _ = check_user_space(space_id, current_user)

    # Set current user as updater
    tag_data["update_user"] = current_user.get("user_id")

    result = tag_repository.tag_update(tag_data)
    return ResponseModel(**result)


@with_exception_handling
def tag_delete(
        query_data: Dict[str, Any],
        current_user: Dict[str, Any]
) -> ResponseModel:
    """Delete a tag.

    Args:
        query_data: Query parameters for deletion
        current_user: Current user information

    Returns:
        ResponseModel indicating deletion result
    """
    # Validate user has access to the space
    space_id = query_data.get("space_id")
    if space_id:
        _ = check_user_space(space_id, current_user)

    result = tag_repository.tag_delete(query_data)
    return ResponseModel(**result)


@with_exception_handling
def tag_get_by_id(
        query_data: Dict[str, Any],
        current_user: Dict[str, Any]
) -> ResponseModel:
    """Get tag by primary ID.

    Args:
        query_data: Query containing primary_id
        current_user: Current user information

    Returns:
        ResponseModel with tag information
    """
    result = tag_repository.tag_get_by_id(query_data)

    # If tag found, validate user has access to the space
    if result.get("code") == status.HTTP_200_OK and result.get("data"):
        space_id = result.get("data").get("space_id")
        if space_id:
            _ = check_user_space(space_id, current_user)

    return ResponseModel(**result)


@with_exception_handling
def tag_search(
        query_data: Dict[str, Any],
        current_user: Dict[str, Any]
) -> ResponseModel:
    """Search tags by name pattern.

    Args:
        query_data: Query containing space_id and search_pattern
        current_user: Current user information

    Returns:
        ResponseModel with matching tags
    """
    # Validate user has access to the space
    space_id = query_data.get("space_id")
    if not space_id:
        return ResponseModel(
            code=status.HTTP_400_BAD_REQUEST,
            message="space_id is required"
        )

    _ = check_user_space(space_id, current_user)

    result = tag_repository.tag_search(query_data)
    return ResponseModel(**result)


@with_exception_handling
def tag_get_or_create(
        tag_data: Dict[str, Any],
        current_user: Dict[str, Any]
) -> ResponseModel:
    """Get existing tag or create if it doesn't exist.

    Args:
        tag_data: Tag data (space_id and tag_name required)
        current_user: Current user information

    Returns:
        ResponseModel with tag information and creation status
    """
    # Validate required fields
    space_id = tag_data.get("space_id")
    tag_name = tag_data.get("tag_name")

    if not space_id or not tag_name:
        return ResponseModel(
            code=status.HTTP_400_BAD_REQUEST,
            message="space_id and tag_name are required"
        )

    # Validate user has access to the space
    _ = check_user_space(space_id, current_user)

    # Try to get existing tag
    query_data = {"space_id": space_id, "tag_name": tag_name}
    existing_tag = tag_repository.tag_get(query_data)

    if existing_tag.get("code") == status.HTTP_200_OK and existing_tag.get("data"):
        # Tag exists, return it
        return ResponseModel(
            code=status.HTTP_200_OK,
            message="Tag found",
            data={
                "tag": existing_tag.get("data"),
                "created": False
            }
        )
    else:
        # Tag doesn't exist, create it
        tag_data.setdefault("create_user", current_user.get("user_id"))
        tag_data.setdefault("update_user", current_user.get("user_id"))

        create_result = tag_repository.tag_create(tag_data)
        if create_result.get("code") == status.HTTP_200_OK:
            return ResponseModel(
                code=status.HTTP_200_OK,
                message="Tag created"
            )
        else:
            # If tag creation failed, return the error
            return ResponseModel(**create_result)


@with_exception_handling
def tag_batch_create(
        tags_data: List[Dict[str, Any]],
        current_user: Dict[str, Any]
) -> ResponseModel:
    """Create multiple tags in batch.

    Args:
        tags_data: List of tag creation data
        current_user: Current user information

    Returns:
        ResponseModel with creation results
    """
    if not tags_data:
        return ResponseModel(
            code=status.HTTP_400_BAD_REQUEST,
            message="No tags data provided"
        )

    # Validate all tags belong to spaces the user has access to
    space_ids = set()
    for tag_data in tags_data:
        space_id = tag_data.get("space_id")
        if space_id:
            space_ids.add(space_id)

    for space_id in space_ids:
        _ = check_user_space(space_id, current_user)

    # Create tags one by one
    created_tags = []
    failed_tags = []

    for tag_data in tags_data:
        # Set user info
        tag_data.setdefault("create_user", current_user.get("user_id"))
        tag_data.setdefault("update_user", current_user.get("user_id"))

        result = tag_repository.tag_create(tag_data)
        if result.get("code") == status.HTTP_200_OK:
            created_tags.append(result.get("data"))
        else:
            failed_tags.append({
                "tag_data": tag_data,
                "error": result.get("message")
            })

    return ResponseModel(
        code=status.HTTP_200_OK,
        message=f"Batch create completed: {len(created_tags)} created, {len(failed_tags)} failed",
        data={
            "created_tags": created_tags,
            "failed_tags": failed_tags
        }
    )
