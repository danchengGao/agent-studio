#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

"""
通用数据库模型同步工具
自动检测模型定义与数据库表结构的差异，并同步新增字段
"""

import importlib
import logging
import pkgutil
import sys
from typing import Any, Dict, List

from sqlalchemy import MetaData, create_engine, inspect, text
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import schema

from openjiuwen_studio.core.database import engine
from openjiuwen_studio.models import (AgentBaseDB, PluginBaseDB, SpaceDB, UserDB,
                        WorkflowBaseDB)

logger = logging.getLogger(__name__)


class DatabaseSync:
    """数据库模型同步器"""

    def __init__(self, db_engine):
        self.engine = db_engine
        self.inspector = inspect(db_engine)

    def get_model_columns(self, model_class) -> Dict[str, Any]:
        """获取模型定义的列信息"""
        columns = {}
        for column in model_class.__table__.columns:
            columns[column.name] = {
                'type': str(column.type),
                'nullable': column.nullable,
                'default': column.default,
                'comment': getattr(column, 'comment', None)
            }
        return columns

    def get_table_columns(self, table_name: str) -> Dict[str, Any]:
        """获取数据库表的实际列信息"""
        try:
            columns = {}
            db_columns = self.inspector.get_columns(table_name)
            for column in db_columns:
                columns[column['name']] = {
                    'type': str(column['type']),
                    'nullable': column.get('nullable', True),
                    'default': column.get('default', None),
                    'comment': column.get('comment', None)
                }
            return columns
        except Exception as e:
            logger.warning(f"无法获取表 {table_name} 的列信息: {e}")
            return {}

    def get_missing_columns(self, model_class) -> List[str]:
        """获取模型中定义但数据库表中缺失的列"""
        table_name = model_class.__tablename__
        model_columns = self.get_model_columns(model_class)
        table_columns = self.get_table_columns(table_name)

        missing_columns = []
        for column_name in model_columns:
            if column_name not in table_columns:
                missing_columns.append(column_name)

        return missing_columns

    def add_column_to_table(self, model_class, column_name: str):
        """向数据库表添加列"""
        table_name = model_class.__tablename__
        column = model_class.__table__.columns[column_name]

        # 构建 ALTER TABLE 语句
        alter_sql = f"""
        ALTER TABLE {table_name}
        ADD COLUMN {column_name} {column.type}
        """

        # 添加 NULL/NOT NULL 约束
        if not column.nullable:
            alter_sql += " NOT NULL"
        else:
            alter_sql += " NULL"

        # 添加默认值
        if column.default is not None:
            if hasattr(column.default, 'arg'):
                alter_sql += f" DEFAULT {column.default.arg}"
            else:
                alter_sql += f" DEFAULT {column.default}"

        # 添加注释（如果支持）
        if hasattr(column, 'comment') and column.comment:
            alter_sql += f" COMMENT '{column.comment}'"

        try:
            with self.engine.connect() as conn:
                conn.execute(text(alter_sql))
                conn.commit()
                logger.info(f"✅ 成功添加列 {column_name} 到表 {table_name}")
        except Exception as e:
            logger.error(f"❌ 添加列失败 {column_name} 到表 {table_name}: {e}")
            raise

    def sync_model(self, model_class):
        """同步单个模型"""
        table_name = model_class.__tablename__

        try:
            # 检查表是否存在
            if not self.inspector.has_table(table_name):
                logger.info(f"📋 表 {table_name} 不存在，跳过字段同步")
                return

            # 获取缺失的列
            missing_columns = self.get_missing_columns(model_class)

            if missing_columns:
                logger.info(f"🔄 检测到表 {table_name} 缺少字段: {missing_columns}")

                # 添加缺失的列
                for column_name in missing_columns:
                    self.add_column_to_table(model_class, column_name)

                logger.info(f"✅ 表 {table_name} 字段同步完成")
            else:
                logger.info(f"✅ 表 {table_name} 字段已同步")

        except Exception as e:
            logger.error(f"❌ 同步表 {table_name} 失败: {e}")
            raise

    def sync_all_models(self, model_classes: List):
        """同步所有模型"""
        logger.info("🔄 开始数据库模型同步...")

        for model_class in model_classes:
            try:
                self.sync_model(model_class)
            except Exception as e:
                logger.error(f"❌ 同步模型 {model_class.__name__} 失败: {e}")
                # 继续同步其他模型，不中断整个过程
                continue

        logger.info("✅ 数据库模型同步完成")


def get_all_model_classes():
    """动态获取所有模型类"""
    model_classes = []

    # 模型配置相关
    from openjiuwen_studio.models.model_config import ModelConfig, ModelUsageLog
    from openjiuwen_studio.models.embedding_model_config import EmbeddingModelConfig

    # 核心业务模型
    from openjiuwen_studio.models.agent import AgentBaseDB as _AgentBaseDB, AgentPublishDB
    from openjiuwen_studio.models.user import UserDB as _UserDB, SpaceDB as _SpaceDB, SpaceUserDB
    from openjiuwen_studio.models.workflow import WorkflowBaseDB as _WorkflowBaseDB, WorkflowPublishDB
    from openjiuwen_studio.models.plugin import PluginBaseDB as _PluginBaseDB, PluginPublishDB, ToolBaseDB

    # 执行相关模型
    from openjiuwen_studio.models.workflow_execution import WorkflowExecutionDB, WorkflowExecutionDetailsDB
    from openjiuwen_studio.models.agent_execution import AgentExecutionDB, AgentExecutionDetailsDB

    # 关联模型
    from openjiuwen_studio.models.prompt_relation import PromptRelationDB
    from openjiuwen_studio.models.tag import TagDB
    from openjiuwen_studio.models.awp_relation import AgentWorkflowRelationDB
    from openjiuwen_studio.models.reference import ReferenceDB

    # 追踪模型
    from openjiuwen_studio.models.trace_detail import TraceDetailDB
    from openjiuwen_studio.models.trace_summary import TraceSummaryDB

    # 知识库模型
    from openjiuwen_studio.models.knowledge_base import KnowledgeBaseDB
    from openjiuwen_studio.models.knowledge_base_document import KnowledgeBaseDocumentDB

    model_classes.extend([
        # 模型配置
        ModelConfig, ModelUsageLog, EmbeddingModelConfig,

        # 核心业务
        _AgentBaseDB, AgentPublishDB,
        _UserDB, _SpaceDB, SpaceUserDB,
        _WorkflowBaseDB, WorkflowPublishDB,
        _PluginBaseDB, PluginPublishDB, ToolBaseDB,

        # 执行相关
        WorkflowExecutionDB, WorkflowExecutionDetailsDB,
        AgentExecutionDB, AgentExecutionDetailsDB,

        # 关联模型
        PromptRelationDB, TagDB, AgentWorkflowRelationDB, ReferenceDB,

        # 追踪模型
        TraceDetailDB, TraceSummaryDB,

        # 知识库模型
        KnowledgeBaseDB, KnowledgeBaseDocumentDB,
    ])

    return model_classes


def run_database_sync():
    """运行数据库同步"""
    try:
        sync = DatabaseSync(engine)
        model_classes = get_all_model_classes()
        sync.sync_all_models(model_classes)

    except Exception as e:
        logger.error(f"❌ 数据库同步失败: {e}")
        raise


if __name__ == "__main__":
    run_database_sync()