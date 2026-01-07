#!/usr/bin/python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved
"""exception"""


class NotFoundException(Exception):
    """资源未找到异常"""
    pass


class RelationException(Exception):
    """资源关联异常"""
    pass


class DuplicateException(Exception):
    """重复资源异常"""
    pass


class ValidationException(Exception):
    """数据验证异常"""
    pass


class UnauthorizedException(Exception):
    """未授权异常"""
    pass


class ForbiddenException(Exception):
    """禁止访问异常"""
    pass


class ServiceException(Exception):
    """服务层异常基类"""
    pass