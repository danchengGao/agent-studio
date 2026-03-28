"""
DeepSearch SSE 数据日志记录模块
提供日志记录、清理和管理功能
"""

import os
import json
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from threading import Lock
from openjiuwen.core.common.logging import logger


class DeepSearchLogger:
    """DeepSearch 日志记录器"""

    # 类级别的锁，确保线程安全
    _lock = Lock()

    # 日志目录路径
    LOG_DIR = Path(__file__).parent.parent.parent / "logs" / "deepsearch"

    # 默认日志过期天数（可配置）
    DEFAULT_LOG_EXPIRE_DAYS = 3

    # 分隔符
    USER_REQUEST_SEPARATOR = "\n" + "=" * 18 + "\n" + "======    user    ======" + "\n" + "=" * 18 + "\n"
    DEEPSEARCH_RESPONSE_SEPARATOR = "\n" + "=" * 23 + "\n" + "======    deepsearch    ======" + "\n" + "=" * 23 + "\n"

    def __init__(self, conversation_id: str, log_expire_days: Optional[int] = None):
        """
        初始化日志记录器

        Args:
            conversation_id: 会话 ID，用于命名日志文件
            log_expire_days: 日志过期天数，默认为 DEFAULT_LOG_EXPIRE_DAYS
        """
        self.conversation_id = conversation_id
        self.log_expire_days = log_expire_days or self.DEFAULT_LOG_EXPIRE_DAYS
        self.log_file_path = self._get_log_file_path()

        # 确保日志目录存在
        self._ensure_log_directory()

    def _get_log_file_path(self) -> Path:
        """获取日志文件路径"""
        return self.LOG_DIR / f"{self.conversation_id}.log"

    def _ensure_log_directory(self):
        """确保日志目录存在"""
        with self._lock:
            self.LOG_DIR.mkdir(parents=True, exist_ok=True)

    async def log_request(self, request_data: Dict[str, Any]):
        """
        记录请求数据，在前面加 user 标志，后面加 deepsearch 标志

        Args:
            request_data: 请求数据字典
        """
        try:
            # 使用 asyncio 在线程池中执行同步文件操作
            await asyncio.to_thread(self._log_request_sync, request_data)
        except Exception as e:
            # 记录错误但不影响主流程
            logger.warning(f"DeepSearch failed to log request: {e}")

    def _log_request_sync(self, request_data: Dict[str, Any]):
        """同步写入请求数据"""
        with open(self.log_file_path, mode='a', encoding='utf-8') as f:
            # 写入时间戳（使用 UTC 时间）
            timestamp = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"\n[{timestamp}] NEW REQUEST\n")

            # 写入用户请求分隔符（在请求数据前面）
            f.write(self.USER_REQUEST_SEPARATOR)

            # 写入请求数据（格式化的 JSON）
            f.write(json.dumps(request_data, ensure_ascii=False, indent=2))
            f.write("\n")

            # 写入 deepsearch 分隔符（在请求数据后面）
            f.write(self.DEEPSEARCH_RESPONSE_SEPARATOR)

    async def log_sse_data(self, sse_data: str):
        """
        记录 SSE 数据流

        Args:
            sse_data: SSE 数据字符串
        """
        try:
            # 使用 asyncio 在线程池中执行同步文件操作
            await asyncio.to_thread(self._log_sse_data_sync, sse_data)
        except Exception as e:
            # 记录错误但不影响主流程
            logger.warning(f"DeepSearch failed to log SSE data: {e}")

    def _log_sse_data_sync(self, sse_data: str):
        """同步写入 SSE 数据"""
        with open(self.log_file_path, mode='a', encoding='utf-8') as f:
            # 直接写入 SSE 数据
            f.write(sse_data)
            f.write("\n")

    @classmethod
    def cleanup_old_logs(cls, expire_days: Optional[int] = None):
        """
        清理过期的日志文件

        Args:
            expire_days: 过期天数，默认为 DEFAULT_LOG_EXPIRE_DAYS
        """
        expire_days = expire_days or cls.DEFAULT_LOG_EXPIRE_DAYS

        try:
            # 确保日志目录存在
            if not cls.LOG_DIR.exists():
                return

            # 计算过期时间阈值（使用 UTC 时间）
            threshold = datetime.now(tz=timezone.utc) - timedelta(days=expire_days)

            # 遍历日志目录
            with cls._lock:
                for log_file in cls.LOG_DIR.glob("*.log"):
                    try:
                        # 获取文件的修改时间（使用 UTC 时间）
                        file_mtime = datetime.fromtimestamp(log_file.stat().st_mtime, tz=timezone.utc)

                        # 如果文件过期，删除它
                        if file_mtime < threshold:
                            log_file.unlink()
                            logger.warning(f"DeepSearch deleted expired log file: {log_file.name}")
                    except Exception as e:
                        logger.warning(f"DeepSearch failed to delete log file {log_file.name}: {e}")
        except Exception as e:
            logger.warning(f"DeepSearch failed to cleanup old logs: {e}")

    @classmethod
    async def cleanup_old_logs_async(cls, expire_days: Optional[int] = None):
        """
        异步清理过期的日志文件

        Args:
            expire_days: 过期天数，默认为 DEFAULT_LOG_EXPIRE_DAYS
        """
        # 在线程池中执行同步清理操作
        await asyncio.to_thread(cls.cleanup_old_logs, expire_days)

    def get_log_file_path(self) -> Path:
        """获取当前日志文件路径"""
        return self.log_file_path


# 便捷函数
async def log_deepsearch_request(conversation_id: str, 
                                 request_data: Dict[str, Any], 
                                 log_expire_days: Optional[int] = None):
    """
    记录 DeepSearch 请求数据

    Args:
        conversation_id: 会话 ID
        request_data: 请求数据
        log_expire_days: 日志过期天数
    """
    ds_logger = DeepSearchLogger(conversation_id, log_expire_days)
    await ds_logger.log_request(request_data)


async def log_deepsearch_sse(conversation_id: str, sse_data: str, log_expire_days: Optional[int] = None):
    """
    记录 DeepSearch SSE 数据

    Args:
        conversation_id: 会话 ID
        sse_data: SSE 数据
        log_expire_days: 日志过期天数
    """
    ds_logger = DeepSearchLogger(conversation_id, log_expire_days)
    await ds_logger.log_sse_data(sse_data)


def cleanup_logs(expire_days: Optional[int] = None):
    """
    清理过期的日志文件（同步）

    Args:
        expire_days: 过期天数
    """
    DeepSearchLogger.cleanup_old_logs(expire_days)


async def cleanup_logs_async(expire_days: Optional[int] = None):
    """
    清理过期的日志文件（异步）

    Args:
        expire_days: 过期天数
    """
    await DeepSearchLogger.cleanup_old_logs_async(expire_days)
