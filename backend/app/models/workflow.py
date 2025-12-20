from __future__ import annotations
from typing import TYPE_CHECKING, Any

from sqlalchemy import (JSON, BigInteger, ForeignKey, Index, String, Text,
                        UniqueConstraint, and_, func, select)
from sqlalchemy.orm import (DeclarativeBase, Mapped, declarative_mixin,
                            foreign, mapped_column, relationship)

from app.core.database import milliseconds
from app.models.db_fun_base import Base, DBFunBase

if TYPE_CHECKING:
    from app.models.awp_relation import AgentWorkflowRelationDB
    from app.models.prompt_relation import PromptRelationDB
    from app.models.workflow_execution import WorkflowExecutionDB


@declarative_mixin
class WorkflowDBMixin:
    primary_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True, name="id")
    name: Mapped[str | None] = mapped_column(String(255), nullable=True, name="workflow_name")
    desc: Mapped[str | None] = mapped_column(String(512), nullable=True, name="description")
    space_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    icon_uri: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    schema: Mapped[str | None] = mapped_column(Text, default=None, nullable=True)

    # 通用 JSON，MySQL/PostgreSQL/SQLite 均支持
    input_parameters: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, default=None, nullable=True)
    output_parameters: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, default=None, nullable=True)
    _rest_: Mapped[dict | None] = mapped_column(JSON, default=None, nullable=True)

    create_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    update_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    

# ==================== tbl_workflow ====================
class WorkflowBaseDB(WorkflowDBMixin, Base, DBFunBase):
    __tablename__ = "workflow"
    __table_args__ = (
        UniqueConstraint(
            "workflow_id", "workflow_version",
            name="unique_workflow_id_version"
        ),
        Index("idx_space_id", "space_id"),
    )
    workflow_id: Mapped[str] = mapped_column(String(100), index=True, unique=True, nullable=False)
    workflow_version: Mapped[str | None] = mapped_column(String(100), default=DBFunBase.__version_none__)
    latest_publish_time: Mapped[int | None] = mapped_column(BigInteger, default=None, nullable=True)
    latest_publish_version: Mapped[str | None] = mapped_column(String(100), default=None, nullable=True)

    # 关联的执行日志
    workflow_executions: Mapped[list["WorkflowExecutionDB"]] = relationship(
        "WorkflowExecutionDB",
        primaryjoin=f"and_(WorkflowExecutionDB.workflow_version=='{DBFunBase.__version_none__}', WorkflowExecutionDB.workflow_id==WorkflowBaseDB.workflow_id, \
            WorkflowExecutionDB.workflow_version==WorkflowBaseDB.workflow_version)",
        foreign_keys="[WorkflowExecutionDB.workflow_id, WorkflowExecutionDB.workflow_version]",
        cascade="all, delete-orphan",
        back_populates="workflow_draft",
    )

    # 关联的prompt
    prompts: Mapped[list["PromptRelationDB"]] = relationship(
        "PromptRelationDB",
        primaryjoin=f"and_(PromptRelationDB.version=='{DBFunBase.__version_none__}', PromptRelationDB.type=='WORKFLOW',\
            PromptRelationDB.id==WorkflowBaseDB.workflow_id, PromptRelationDB.version==WorkflowBaseDB.workflow_version)",
        foreign_keys="[PromptRelationDB.id, PromptRelationDB.version]",
        cascade="all, delete-orphan",
        back_populates="workflow_draft",
    )

    # 所有发布版本的workflow
    workflow_publish_list: Mapped[list[WorkflowPublishDB]] = relationship(
        "WorkflowPublishDB",
        foreign_keys="WorkflowPublishDB.workflow_id",
        back_populates="workflow_draft",
        cascade="all, delete-orphan",        # ← 内存+数据库都会删
    )

    # 延迟加载最新的发布版本workflow
    latest_publish_workflow: Mapped[WorkflowPublishDB | None] = relationship(
        "WorkflowPublishDB",
        primaryjoin=lambda: and_(
            WorkflowBaseDB.workflow_id == foreign(WorkflowPublishDB.workflow_id),
            WorkflowPublishDB.primary_id == (
                select(func.max(WorkflowPublishDB.primary_id))
                .where(WorkflowPublishDB.workflow_id == WorkflowBaseDB.workflow_id)
                .correlate(WorkflowBaseDB)
                .scalar_subquery()
            )
        ),
        uselist=False,          # 只返回一条或 None
        viewonly=True,          # 只读，不会持久化
    )

    agent_workflow_relations: Mapped[list["AgentWorkflowRelationDB"]] = relationship(
        "AgentWorkflowRelationDB",
        primaryjoin=f"and_(AgentWorkflowRelationDB.workflow_version=='{DBFunBase.__version_none__}', AgentWorkflowRelationDB.workflow_id==WorkflowBaseDB.workflow_id, \
            AgentWorkflowRelationDB.workflow_version==WorkflowBaseDB.workflow_version)",
        foreign_keys="[AgentWorkflowRelationDB.workflow_id, AgentWorkflowRelationDB.workflow_version]",
        cascade="all, delete-orphan",
        back_populates="workflow_draft",
    )

    def update_workflow_latest_publish_version(self):
        latest_publish = self.latest_publish_workflow
        if latest_publish:
            self.latest_publish_time = latest_publish.create_time
            self.latest_publish_version = latest_publish.workflow_version
        else:
            self.latest_publish_time = None
            self.latest_publish_version = None
        self.update_time = milliseconds()
    
    def __repr__(self) -> str:
        return (
            f"<{self.__tablename__}("
            f"space_id='{self.space_id}', "
            f"workflow_id={self.workflow_id}, "
            f"workflow_version={self.workflow_version}, "
            f"workflow_name='{self.name})>"
        )

# ==================== tbl_workflow_publish ====================


class WorkflowPublishDB(WorkflowDBMixin, Base, DBFunBase):
    __tablename__ = "workflow_publish"
    __table_args__ = (
        UniqueConstraint(
            "workflow_id", "workflow_version",
            name="unique_workflow_id_version"
        ),
        Index("idx_space_id", "space_id"),
    )
    workflow_id: Mapped[str] = mapped_column(String(100),
                                    ForeignKey("workflow.workflow_id"),
                                    nullable=False,
                                    index=True,
                                    )
    workflow_version: Mapped[str] = mapped_column(String(100), nullable=False)
    version_description: Mapped[str | None] = mapped_column(String(255))

    workflow_draft: Mapped[WorkflowBaseDB] = relationship(
        "WorkflowBaseDB",
        foreign_keys=workflow_id,
        back_populates="workflow_publish_list",
    )
    
    workflow_executions: Mapped[list["WorkflowExecutionDB"]] = relationship(
        "WorkflowExecutionDB",
        primaryjoin=f"and_(WorkflowExecutionDB.workflow_version!='{DBFunBase.__version_none__}', WorkflowExecutionDB.workflow_id==WorkflowPublishDB.workflow_id, \
            WorkflowExecutionDB.workflow_version==WorkflowPublishDB.workflow_version)",
        foreign_keys="[WorkflowExecutionDB.workflow_id, WorkflowExecutionDB.workflow_version]",
        cascade="all, delete-orphan",
        back_populates="workflow_publish",
    )

    prompts: Mapped[list["PromptRelationDB"]] = relationship(
        "PromptRelationDB",
        primaryjoin=f"and_(PromptRelationDB.version!='{DBFunBase.__version_none__}', PromptRelationDB.type=='WORKFLOW',\
            PromptRelationDB.id==WorkflowPublishDB.workflow_id, PromptRelationDB.version==WorkflowPublishDB.workflow_version)",
        foreign_keys="[PromptRelationDB.id, PromptRelationDB.version]",
        cascade="all, delete-orphan",
        back_populates="workflow_publish",
    )
    
    agent_workflow_relations: Mapped[list["AgentWorkflowRelationDB"]] = relationship(
        "AgentWorkflowRelationDB",
        primaryjoin=f"and_(AgentWorkflowRelationDB.workflow_version!='{DBFunBase.__version_none__}', AgentWorkflowRelationDB.workflow_id==WorkflowPublishDB.workflow_id, \
            AgentWorkflowRelationDB.workflow_version==WorkflowPublishDB.workflow_version)",
        foreign_keys="[AgentWorkflowRelationDB.workflow_id, AgentWorkflowRelationDB.workflow_version]",
        cascade="all, delete-orphan",
        back_populates="workflow_publish",
    )

    def __repr__(self) -> str:
        return (
            f"<{self.__tablename__}("
            f"space_id='{self.space_id}', "
            f"workflow_id={self.workflow_id}, "
            f"workflow_version={self.workflow_version}, "
            f"workflow_name='{self.name})>"
        )


WorkflowBaseDBPd = WorkflowBaseDB.sqlalchemy_to_pydantic(exclude={"primary_id", })
WorkflowPublishDBPd = WorkflowPublishDB.sqlalchemy_to_pydantic(exclude={"primary_id", })
