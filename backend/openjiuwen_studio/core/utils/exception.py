import traceback
from typing import Any
from fastapi import HTTPException

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.core.config import settings

ERROR_MESSAGE_MAPPING = {
    # 网络相关异常
    'ConnectionError': "服务连接失败，请稍后重试",
    'TimeoutError': "服务连接超时，请稍后重试",
    # 权限认证相关异常
    'PermissionError': "权限不足或认证失败",
    'AuthenticationError': "权限不足或认证失败",
    # 参数验证相关异常
    'ValueError': "请求参数格式错误",
    'ValidationError': "请求参数格式错误",
    # 文件操作相关异常
    'FileNotFoundError': "文件操作失败",
    'IOError': "文件操作失败",
    # 数据库相关异常
    'DatabaseError': "数据库操作失败",
    'IntegrityError': "数据库操作失败",
}


def log_exception(e: Exception):
    """记录异常详情到日志，包含完整的堆栈信息"""
    logger.error(f"Exception: {repr(e)}")
    stack_frames = traceback.extract_tb(e.__traceback__)
    for frame in stack_frames:
        logger.debug(
            f"File \"{frame.filename}\", line {frame.lineno}, in {frame.name}")


def get_safe_error_message(e: Exception, custom_message: str = None) -> str:
    """
    获取安全的错误消息，避免敏感信息泄露

    Args:
        e: 异常对象
        custom_message: 自定义错误消息

    Returns:
        str: 安全的错误消息
    """
    if settings.debug:
        # 开发环境：返回详细错误信息
        return f"{custom_message}: {str(e)}" if custom_message else str(e)
    # 生产环境：返回通用错误消息
    if custom_message:
        return custom_message

    # 根据异常类型返回相应的通用消息
    error_type = type(e).__name__

    return ERROR_MESSAGE_MAPPING.get(error_type, "System internal error, please contact the administrator")


def handle_http_exception(e: Exception, custom_message: str = None, status_code: int = 500) -> Exception:
    """
    处理HTTP异常，返回安全的异常信息

    Args:
        e: 原始异常
        custom_message: 自定义错误消息
        status_code: HTTP状态码

    Returns:
        Exception: 处理后的HTTPException
    """
    # 记录完整异常信息到日志
    log_exception(e)

    # 获取安全的错误消息
    safe_message = get_safe_error_message(e, custom_message)

    return HTTPException(status_code=status_code, detail=safe_message)
