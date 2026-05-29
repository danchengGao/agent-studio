"""
DeepSearch SSE 数据日志记录模块
提供日志记录、清理和管理功能
"""

import os
import json
import asyncio
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from threading import Lock
from openjiuwen.core.common.logging import logger


class DeepSearchLogger:
    """DeepSearch 日志记录器"""

    # 类级别的锁，确保线程安全
    _lock = Lock()

    @classmethod
    def _get_log_dir(cls) -> Path:
        """获取日志目录路径，与 run/interface/performance 使用相同配置"""
        # config.yaml 中配置：log_path: "./logs/"
        # 直接使用相同的路径，确保与 run/interface/performance 在同一目录下
        return Path("./logs/deepsearch")

    # 默认日志过期天数（可配置）
    DEFAULT_LOG_EXPIRE_DAYS = 3
    MAX_LOG_FILE_STEM_LENGTH = 128
    REDACTED_VALUE = "***REDACTED***"
    SENSITIVE_KEYS = {
        "api_key",
        "api_secret",
        "access_token",
        "refresh_token",
        "password",
        "secret",
        "secret_key",
        "token",
    }

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
        self._log_dir = self._get_log_dir()  # 实例变量，缓存日志目录
        self.log_file_path = self._get_log_file_path()

        # 确保日志目录存在
        self._ensure_log_directory()

    def _get_log_file_path(self) -> Path:
        """获取日志文件路径"""
        log_dir = self._log_dir.resolve()
        log_file_path = (log_dir / f"{self._safe_log_file_stem(self.conversation_id)}.log").resolve()
        log_file_path.relative_to(log_dir)
        return log_file_path

    @classmethod
    def _safe_log_file_stem(cls, conversation_id: str) -> str:
        raw_id = str(conversation_id or "").strip()
        if not raw_id:
            return "unknown"

        raw_path = Path(raw_id)
        if raw_path.is_absolute():
            parts = [part for part in raw_path.parts if part not in (raw_path.anchor, os.sep, "")]
            raw_id = "_" + "_".join(parts)
        else:
            parts = [part for part in raw_path.parts if part not in ("", ".", "..")]
            raw_id = "_".join(parts)

        safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "_", raw_id).strip(".")
        if not safe_stem:
            safe_stem = "unknown"
        return safe_stem[:cls.MAX_LOG_FILE_STEM_LENGTH]

    @classmethod
    def _redact_sensitive_data(cls, data: Any) -> Any:
        if isinstance(data, dict):
            redacted = {}
            for key, value in data.items():
                key_text = str(key)
                if key_text.lower() in cls.SENSITIVE_KEYS:
                    redacted[key] = cls.REDACTED_VALUE
                else:
                    redacted[key] = cls._redact_sensitive_data(value)
            return redacted
        if isinstance(data, list):
            return [cls._redact_sensitive_data(item) for item in data]
        return data

    def _ensure_log_directory(self):
        """确保日志目录存在"""
        with self._lock:
            self._log_dir.mkdir(parents=True, exist_ok=True)

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
            f.write(json.dumps(self._redact_sensitive_data(request_data), ensure_ascii=False, indent=2))
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
            # 获取日志目录
            log_dir = cls._get_log_dir()

            # 确保日志目录存在
            if not log_dir.exists():
                return

            # 计算过期时间阈值（使用 UTC 时间）
            threshold = datetime.now(tz=timezone.utc) - timedelta(days=expire_days)

            # 遍历日志目录
            with cls._lock:
                for log_file in log_dir.glob("*.log"):
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
