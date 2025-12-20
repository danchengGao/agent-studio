#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from ops.config import settings

# 配置日志
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


def get_database_url(db_name: str = None) -> str:
    """生成数据库连接URL"""
    if db_name == "ops":
        return (f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@"
               f"{settings.DB_HOST}:{settings.DB_PORT}/{settings.OPS_DB_NAME}?charset=utf8mb4")
    elif db_name == "agent":
        return (f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@"
               f"{settings.DB_HOST}:{settings.DB_PORT}/{settings.AGENT_DB_NAME}?charset=utf8mb4")
    else:
        raise ValueError(f"Unknown database name: {db_name}")


def get_async_database_url(db_url: str) -> str:
    """将同步数据库URL转换为异步URL"""
    return db_url.replace("pymysql", "aiomysql")


def _check_async_drivers():
    """检查异步数据库驱动是否可用"""
    try:
        import aiomysql
        return True
    except ImportError:
        return False


# 延迟初始化的数据库引擎和会话工厂
engine = None
engine_agent = None
SessionLocalOps = None
SessionLocalAgent = None
async_engine_ops = None
async_engine_agent = None
AsyncSessionLocalOps = None
AsyncSessionLocalAgent = None


def _get_engine_kwargs():
    """获取数据库引擎参数"""
    return {
        "pool_pre_ping": True,
        "pool_recycle": 3600,
        "echo": settings.DEBUG
    }


def _init_engines():
    """初始化数据库引擎"""
    global engine, engine_agent, SessionLocalOps, SessionLocalAgent
    global async_engine_ops, async_engine_agent, AsyncSessionLocalOps, AsyncSessionLocalAgent

    if engine and engine_agent:
        return  # 已经初始化过了

    try:
        # 获取数据库连接URL
        DATABASE_URL_OPS = get_database_url("ops")
        DATABASE_URL_AGENT = get_database_url("agent")

        # 获取引擎参数
        engine_kwargs = _get_engine_kwargs()

        # 同步引擎
        engine = create_engine(DATABASE_URL_OPS, **engine_kwargs)
        engine_agent = create_engine(DATABASE_URL_AGENT, **engine_kwargs)

        # 同步会话工厂
        SessionLocalOps = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        SessionLocalAgent = sessionmaker(autocommit=False, autoflush=False, bind=engine_agent)

        # 异步引擎配置（仅在驱动可用时初始化）
        if _check_async_drivers():
            async_engine_kwargs = engine_kwargs.copy()

            # 异步数据库URL
            ASYNC_DATABASE_URL_OPS = get_async_database_url(DATABASE_URL_OPS)
            ASYNC_DATABASE_URL_AGENT = get_async_database_url(DATABASE_URL_AGENT)

            global async_engine_ops, async_engine_agent
            global AsyncSessionLocalOps, AsyncSessionLocalAgent
            async_engine_ops = create_async_engine(ASYNC_DATABASE_URL_OPS, **async_engine_kwargs)
            async_engine_agent = create_async_engine(ASYNC_DATABASE_URL_AGENT, **async_engine_kwargs)

            # 异步会话工厂
            AsyncSessionLocalOps = sessionmaker(bind=async_engine_ops, class_=AsyncSession, expire_on_commit=False)
            AsyncSessionLocalAgent = sessionmaker(bind=async_engine_agent, class_=AsyncSession, expire_on_commit=False)
        else:
            logger.warning("警告: 异步数据库驱动不可用，只使用同步数据库功能")
            # 设置异步引擎为None，后续使用时需要检查
            async_engine_ops = None
            async_engine_agent = None
            AsyncSessionLocalOps = None
            AsyncSessionLocalAgent = None

    except ImportError as e:
        # 处理缺少驱动的情况
        if "pymysql" in str(e):
            logger.warning(f"警告: MySQL驱动不可用，请安装 pymysql: pip install pymysql")
            logger.warning("继续运行，但数据库功能将不可用")
        else:
            logger.warning(f"数据库初始化警告: {e}")
            raise
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")
        raise


def get_database_url_cached(db_name: str = None) -> str:
    """获取缓存的数据库URL"""
    return get_database_url(db_name)


Base = declarative_base()
BaseAgent = declarative_base()


def get_db_ops():
    """提供ops数据库会话的依赖"""
    _init_engines()  # 确保引擎已初始化
    db = SessionLocalOps()
    try:
        yield db
    finally:
        try:
            db.close()
        except Exception as e:
            logger.warning(f"Error closing database session: {e}")


def get_db_agent():
    """提供agent数据库会话的依赖"""
    _init_engines()  # 确保引擎已初始化
    db = SessionLocalAgent()
    try:
        yield db
    finally:
        try:
            db.close()
        except Exception as e:
            logger.warning(f"Error closing database session: {e}")


async def get_async_session_ops() -> AsyncSession:
    """获取ops数据库的异步会话"""
    _init_engines()  # 确保引擎已初始化
    if AsyncSessionLocalOps is None:
        raise RuntimeError("异步数据库驱动不可用，无法创建异步会话")
    async with AsyncSessionLocalOps() as session:
        yield session


async def get_async_session_agent() -> AsyncSession:
    """获取agent数据库的异步会话"""
    _init_engines()  # 确保引擎已初始化
    if AsyncSessionLocalAgent is None:
        raise RuntimeError("异步数据库驱动不可用，无法创建异步会话")
    async with AsyncSessionLocalAgent() as session:
        yield session


def create_database_tables():
    """创建数据库表"""
    try:
        _init_engines()  # 确保引擎已初始化
        logger.info("Creating tables for mysql database...")

        # 创建OPS数据库表
        Base.metadata.create_all(bind=engine)
        logger.info("OPS database tables created successfully")

        # 创建Agent数据库表
        BaseAgent.metadata.create_all(bind=engine_agent)
        logger.info("Agent database tables created successfully")

        logger.info("Evaluation database tables creation completed")

    except Exception as e:
        logger.error(f"数据库表创建失败: {e}")
        # 如果是驱动相关的错误，提供友好的提示
        error_str = str(e).lower()
        if "pymysql" in error_str:
            logger.error("提示: 请安装MySQL驱动: pip install pymysql")
        elif "aiomysql" in error_str:
            logger.warning("提示: 异步驱动不可用，但不影响同步功能")
        else:
            logger.error(f"未知错误: {e}")
        raise


def get_database_info():
    """获取当前数据库配置信息"""
    DATABASE_URL_OPS = get_database_url("ops")
    DATABASE_URL_AGENT = get_database_url("agent")

    return {
        "type": "mysql",
        "ops_url": DATABASE_URL_OPS.split("://")[0] + "://***",  # 隐藏密码
        "agent_url": DATABASE_URL_AGENT.split("://")[0] + "://***",  # 隐藏密码
        "debug": settings.DEBUG
    }


# 导出便利函数
def is_mysql() -> bool:
    """检查是否使用MySQL"""
    return True