"""feat: add obs_name to knowledge_base_document (MySQL)

Revision ID: a1b2c3d4e5f6
Revises: 072ac1293a02
Create Date: 2026-03-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql
from openjiuwen_studio.core.database.migration_utils import table_exists, column_exists

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "30acb51653ea"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """为 knowledge_base_document 表添加 obs_name 列（若不存在）。"""
    if not table_exists("knowledge_base_document"):
        return
    if column_exists("knowledge_base_document", "obs_name"):
        return
    op.add_column(
        "knowledge_base_document",
        sa.Column(
            "obs_name",
            mysql.VARCHAR(collation="utf8mb4_unicode_ci", length=1000),
            nullable=True,
            server_default=sa.text("''"),
            comment="OBS 存储路径在存储桶中",
        ),
    )
    # 将已有行的空值设为 ''，再改为 NOT NULL（与模型一致）
    op.execute(
        sa.text("UPDATE knowledge_base_document SET obs_name = '' WHERE obs_name IS NULL")
    )
    op.alter_column(
        "knowledge_base_document",
        "obs_name",
        existing_type=mysql.VARCHAR(collation="utf8mb4_unicode_ci", length=1000),
        nullable=False,
        existing_comment="OBS 存储路径在存储桶中",
    )


def downgrade() -> None:
    """移除 knowledge_base_document 表的 obs_name 列。"""
    if not table_exists("knowledge_base_document"):
        return
    if not column_exists("knowledge_base_document", "obs_name"):
        return
    op.drop_column("knowledge_base_document", "obs_name")
