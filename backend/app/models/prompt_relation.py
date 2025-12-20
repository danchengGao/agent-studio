from sqlalchemy import BigInteger, String, UniqueConstraint, Index, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.db_fun_base import Base, DBFunBase
from app.models.workflow import WorkflowBaseDB, WorkflowPublishDB
from app.models.agent import AgentBaseDB, AgentPublishDB


# ==================== user 表 ====================
class PromptRelationDB(Base, DBFunBase):
    __tablename__ = "prompt_relation"
    __table_args__ = (
        UniqueConstraint(
            "prompt_id", "prompt_version", "aw_id", "aw_version",
            name="unique_prompt_id_version_aw_id_version"
        ),
        Index("idx_space_id", "space_id"),
    )

    # 主键
    primary_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True, comment="Primary Key ID", name="id"
    )

    space_id: Mapped[str | None] = mapped_column(String(100), default=None, nullable=True)
    prompt_id: Mapped[str | None] = mapped_column(String(100), default=None, nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(100), default=None, nullable=True)
    prompt_name: Mapped[str | None] = mapped_column(String(255), default=None, nullable=True)
    id: Mapped[str | None] = mapped_column(String(100), default=None, nullable=True,
                                           comment='workflow/agent的id, 与prompt关联', name="aw_id")
    version: Mapped[str | None] = mapped_column(
        String(100), default=None, nullable=True, comment='workflow/agentir的version', name="aw_version")
    name: Mapped[str | None] = mapped_column(
        String(255), default=None, nullable=True, comment='workflow/agentir的name', name="aw_name")
    type: Mapped[str | None] = mapped_column(
        String(100), default=None, nullable=True, comment='AW Type: AGENT/WORKFLOW/PROMPT')
    is_active: Mapped[int] = mapped_column(Boolean, default=False, nullable=False)

    # 时间戳
    create_time: Mapped[int | None] = mapped_column(BigInteger, default=None, nullable=True)
    update_time: Mapped[int | None] = mapped_column(BigInteger, default=None, nullable=True)

    # 与workflow表关联
    workflow_draft: Mapped[WorkflowBaseDB] = relationship(
        "WorkflowBaseDB",
        primaryjoin=f"and_(PromptRelationDB.version=='{DBFunBase.__version_none__}', PromptRelationDB.type=='WORKFLOW',\
            PromptRelationDB.id==WorkflowBaseDB.workflow_id, PromptRelationDB.version==WorkflowBaseDB.workflow_version)",
        foreign_keys=[id, version],
        back_populates="prompts",
    )
    
    # 与workflow_publish表关联
    workflow_publish: Mapped[WorkflowPublishDB] = relationship(
        "WorkflowPublishDB",
        primaryjoin=f"and_(PromptRelationDB.version!='{DBFunBase.__version_none__}', PromptRelationDB.type=='WORKFLOW',\
            PromptRelationDB.id==WorkflowPublishDB.workflow_id, PromptRelationDB.version==WorkflowPublishDB.workflow_version)",
        foreign_keys=[id, version],
        back_populates="prompts",
    )

    # 与agent表关联
    agent_draft: Mapped[AgentBaseDB] = relationship(
        "AgentBaseDB",
        primaryjoin=f"and_(PromptRelationDB.version=='{DBFunBase.__version_none__}', PromptRelationDB.type=='AGENT',\
            PromptRelationDB.id==AgentBaseDB.agent_id, PromptRelationDB.version==AgentBaseDB.agent_version)",
        foreign_keys=[id, version],
        back_populates="prompts",
    )
    
    # 与agent_publish表关联
    agent_publish: Mapped[AgentPublishDB] = relationship(
        "AgentPublishDB",
        primaryjoin=f"and_(PromptRelationDB.version!='{DBFunBase.__version_none__}', PromptRelationDB.type=='AGENT',\
            PromptRelationDB.id==AgentPublishDB.agent_id, PromptRelationDB.version==AgentPublishDB.agent_version)",
        foreign_keys=[id, version],
        back_populates="prompts",
    )

    # 通用父对象访问器
    def get_agent(self):
        if self.type == "AGENT":
            if self.version == DBFunBase.__version_none__:
                return self.agent_draft
            else:
                return self.agent_publish
        return None
    
    def get_workflow(self):
        if self.type == "WORKFLOW":
            if self.version == DBFunBase.__version_none__:
                return self.workflow_draft
            else:
                return self.workflow_publish
        return None

    def __repr__(self) -> str:
        return (
            f"<{self.__tablename__}("
            f"space_id='{self.space_id}', "
            f"prompt_id={self.prompt_id}, "
            f"prompt_version={self.prompt_version}, "
            f"prompt_name='{self.prompt_name}', "
            f"aw_id='{self.id}', "
            f"aw_version='{self.version}', "
            f"aw_name='{self.name}', "
            f"type={self.type})>"
        )

