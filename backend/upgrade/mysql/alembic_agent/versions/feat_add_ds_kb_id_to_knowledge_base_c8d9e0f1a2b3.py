#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2026. All rights reserved.
"""feat: add ds_kb_id column to knowledge_base table for DeepSearch sync.

Stores DeepSearch knowledge base ID when a Studio KB is synced to DeepSearch.
Revision ID: c8d9e0f1a2b3
Revises: a1b2c3d4e5f6
Create Date: 2026-03-02
"""
from typing import Sequence, Union

from alembic import op
from openjiuwen_studio.core.database.migration_utils import column_exists, table_exists
import sqlalchemy as sa

revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ds_kb_id column for DeepSearch knowledge base linkage."""
    if not table_exists("knowledge_base"):
        return
    if column_exists("knowledge_base", "ds_kb_id"):
        return
    op.add_column(
        "knowledge_base",
        sa.Column(
            "ds_kb_id",
            sa.String(length=100),
            nullable=True,
            comment="DeepSearch 知识库 ID，关联 Studio 与 DS 知识库",
        ),
    )


def downgrade() -> None:
    """Remove ds_kb_id column."""
    if not table_exists("knowledge_base"):
        return
    if not column_exists("knowledge_base", "ds_kb_id"):
        return
    op.drop_column("knowledge_base", "ds_kb_id")
