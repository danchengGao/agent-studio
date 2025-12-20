import logging
import logging.config
import time
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.common.config import config as jiuwen_config
from app.core.config import settings


def get_database_url() -> str:
    """根据数据库类型生成数据库连接URL"""
    return (f"mysql+pymysql://{settings.db_user}:{settings.db_password}@"
                   f"{settings.db_host}:{settings.db_port}/{settings.agent_db_name}?charset=utf8mb4")


database_url = get_database_url()

# Create database engine
engine = create_engine(
    database_url,
    connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Create base class for models
Base = declarative_base()


# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_milliseconds() -> int:
    """返回当前时间戳的毫秒整数部分."""
    return int(time.time() * 1000)


milliseconds = get_milliseconds


# 初始化logging工具
def init_log():
    db_logconf = jiuwen_config.db.log.raw_config
    logging.config.dictConfig(db_logconf)
    logger = logging.getLogger('db_manager')
    return logger


jiuwen_db_logger = init_log()