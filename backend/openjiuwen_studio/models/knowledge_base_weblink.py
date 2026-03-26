from __future__ import annotations
from typing import TYPE_CHECKING, Any, Dict

from sqlalchemy import JSON, BigInteger, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, declarative_mixin, mapped_column, relationship
from openjiuwen_studio.ops.config import settings
from openjiuwen_studio.models.db_fun_base import Base, DBFunBase

if TYPE_CHECKING:
    pass


@declarative_mixin
class KnowledgeBaseWeblinkDBMixin:
    """知识库网页链接数据模型 Mixin"""

    if settings.DB_TYPE.lower() == "sqlite":
        primary_id: Mapped[int] = mapped_column(
            Integer, primary_key=True, autoincrement=True, name="id"
        )
    else:
        primary_id: Mapped[int] = mapped_column(
            BigInteger, primary_key=True, autoincrement=True, name="id"
        )

    # 关联字段
    space_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="空间ID，用于多租户隔离"
    )
    kb_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True, comment="知识库ID")
    weblink_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True, comment="链接ID，唯一标识"
    )

    # 链接基本信息
    url: Mapped[str] = mapped_column(Text, nullable=False, comment="源 URL")
    name: Mapped[str] = mapped_column(String(500), nullable=False, comment="展示名（解析后可为标题）")
    source_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="web_page / wechat_article"
    )

    # 链接状态
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="uploaded", comment="链接状态"
    )

    # Indexing details
    index_manager_type: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="Whether Chroma or Milvus is used for indexing"
    )
    index_id: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="索引ID")
    index_name: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="索引名称")
    chunk_count: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=0, comment="分块数量"
    )

    # 处理信息
    process_info: Mapped[Dict[str, Any] | None] = mapped_column(
        JSON, nullable=True, comment="处理信息（错误信息、处理进度、task_id 等）"
    )

    # 元数据
    doc_metadata: Mapped[Dict[str, Any] | None] = mapped_column(
        JSON, nullable=True, name="metadata", comment="元数据"
    )

    # 扩展字段
    _rest_: Mapped[Dict | None] = mapped_column(JSON, nullable=True, comment="扩展字段")

    # 时间戳
    create_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment="创建时间")
    update_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment="更新时间")
    indexed_time: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, comment="索引完成时间"
    )


# ==================== 知识库网页链接表 ====================
class KnowledgeBaseWeblinkDB(KnowledgeBaseWeblinkDBMixin, Base, DBFunBase):
    """知识库网页链接数据表

    设计说明：
    - 存储网页链接的元数据信息
    - 链接无物理文件，通过 url 解析后索引
    - 通过 kb_id + space_id 关联到知识库
    """

    __tablename__ = "knowledge_base_weblink"
    __table_args__ = (
        UniqueConstraint("weblink_id", name="uix_weblink_id"),
        Index("idx_space_id", "space_id"),
        Index("idx_kb_id", "kb_id"),
        Index("idx_space_kb", "space_id", "kb_id"),
        Index("idx_status", "status"),
        Index("idx_space_kb_weblink", "space_id", "kb_id", "weblink_id"),
        {"comment": "知识库网页链接表，存储链接元数据信息"},
    )
