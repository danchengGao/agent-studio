from typing import Optional

from sqlalchemy import (BigInteger, Column, Index, String, Table,
                        UniqueConstraint, Integer)
from sqlalchemy.orm import (Mapped, declarative_mixin, mapped_column)

from openjiuwen_studio.core.database import Base as meta_base
from openjiuwen_studio.models.db_fun_base import Base, DBFunBase
from openjiuwen_studio.ops.config import settings

# Workflow-Tag 关联表
workflow_tag_association = Table(
    'workflow_tag_association',
    meta_base.metadata,
    Column('workflow_id', String(100), nullable=False),
    Column('workflow_version', String(100), nullable=False),
    Column('tag_id', BigInteger, nullable=False),
    Column('space_id', String(100), nullable=False),
    Column('create_time', BigInteger, nullable=True),
    UniqueConstraint('workflow_id', 'workflow_version', 'tag_id', name='uix_workflow_tag'),
    Index('idx_workflow_tag_space', 'space_id'),
    Index('idx_workflow_tag_workflow', 'workflow_id', 'workflow_version'),
    Index('idx_workflow_tag_tag', 'tag_id')
)


@declarative_mixin
class TagDBMixin:
    """标签基础字段混入"""
    if settings.DB_TYPE.lower() == "sqlite":
        primary_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, name="id")
    else:
        primary_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True, name="id")

    space_id: Mapped[str] = mapped_column(String(100), nullable=False)
    tag_name: Mapped[str] = mapped_column(String(100), nullable=False)
    tag_color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # 颜色代码，如 #FF5733
    is_active: Mapped[bool] = mapped_column(default=True)  # 是否启用
    usage_count: Mapped[int] = mapped_column(default=0)  # 使用次数
    create_time: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    update_time: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    create_user: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    update_user: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class TagDB(TagDBMixin, Base, DBFunBase):
    """标签主表"""
    __tablename__ = "tag"
    __table_args__ = (
        UniqueConstraint("space_id", "tag_name", name="uix_space_tag_name"),
        Index("idx_tag_space", "space_id"),
        Index("idx_tag_active", "is_active"),
    )

    def __repr__(self) -> str:
        return (
            f"<Tag(id={self.primary_id}, "
            f"space_id='{self.space_id}', "
            f"tag_name='{self.tag_name}')>"
        )
