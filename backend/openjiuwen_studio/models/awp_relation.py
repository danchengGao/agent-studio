from sqlalchemy import BigInteger, JSON, String, UniqueConstraint, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from openjiuwen_studio.models.db_fun_base import Base, DBFunBase
from openjiuwen_studio.models.workflow import WorkflowBaseDB, WorkflowPublishDB
from openjiuwen_studio.models.agent import AgentBaseDB, AgentPublishDB
from ops.config import settings

'''
the relation between agent/workflow/plugin
'''


class AgentWorkflowRelationDB(Base, DBFunBase):
    __tablename__ = "agent_workflow_relation"
    __table_args__ = (
        UniqueConstraint("space_id", "agent_id", "agent_version", "workflow_id",
                         "workflow_version", name="uix_agent_workflow_relation"),
        Index("idx_agent", "space_id", "agent_id", "agent_version"),
        Index("idx_workflow", "space_id", "workflow_id", "workflow_version"),
    )

    if settings.DB_TYPE.lower() == "sqlite":
        primary_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, name="id")
    else:
        primary_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True, name="id")

    space_id: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_version: Mapped[str] = mapped_column(String(100), nullable=False)
    workflow_id: Mapped[str] = mapped_column(String(100), nullable=False)
    workflow_version: Mapped[str] = mapped_column(String(100), nullable=False)
    create_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    update_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
      
    # 与workflow表关联
    workflow_draft: Mapped[WorkflowBaseDB] = relationship(
        "WorkflowBaseDB",
        primaryjoin=f"and_(AgentWorkflowRelationDB.workflow_version=='{DBFunBase.__version_none__}', AgentWorkflowRelationDB.workflow_id==WorkflowBaseDB.workflow_id, \
            AgentWorkflowRelationDB.workflow_version==WorkflowBaseDB.workflow_version)",
        foreign_keys=[workflow_id, workflow_version],
        back_populates="agent_workflow_relations",
    )
    # 与workflow_publish表关联
    workflow_publish: Mapped[WorkflowPublishDB] = relationship(
        "WorkflowPublishDB",
        primaryjoin=f"and_(AgentWorkflowRelationDB.workflow_version!='{DBFunBase.__version_none__}', AgentWorkflowRelationDB.workflow_id==WorkflowPublishDB.workflow_id, \
            AgentWorkflowRelationDB.workflow_version==WorkflowPublishDB.workflow_version)",
        foreign_keys=[workflow_id, workflow_version],
        back_populates="agent_workflow_relations",
    )
    
    # 通用父对象访问器
    def get_workflow(self):
        if self.workflow_version == DBFunBase.__version_none__:
            return self.workflow_draft
        else:
            return self.workflow_publish

    # 与agent表关联
    agent_draft: Mapped[AgentBaseDB] = relationship(
        "AgentBaseDB",
        primaryjoin=f"and_(AgentWorkflowRelationDB.agent_version=='{DBFunBase.__version_none__}', AgentWorkflowRelationDB.agent_id==AgentBaseDB.agent_id, \
            AgentWorkflowRelationDB.agent_version==AgentBaseDB.agent_version)",
        foreign_keys=[agent_id, agent_version],
        back_populates="agent_workflow_relations",
    )
    # 与agent_publish表关联
    agent_publish: Mapped[AgentPublishDB] = relationship(
        "AgentPublishDB",
        primaryjoin=f"and_(AgentWorkflowRelationDB.agent_version!='{DBFunBase.__version_none__}', AgentWorkflowRelationDB.agent_id==AgentPublishDB.agent_id, \
            AgentWorkflowRelationDB.agent_version==AgentPublishDB.agent_version)",
        foreign_keys=[agent_id, agent_version],
        back_populates="agent_workflow_relations",
    )

    # 通用父对象访问器
    def get_agent(self):
        if self.agent_version == DBFunBase.__version_none__:
            return self.agent_draft
        else:
            return self.agent_publish

    def __repr__(self) -> str:
        return (
            f"<{self.__tablename__}("
            f"space_id='{self.space_id}', "
            f"agent_id={self.agent_id}, "
            f"agent_version={self.agent_version}, "
            f"workflow_id='{self.workflow_id}, "
            f"workflow_version='{self.workflow_version})>"
        )