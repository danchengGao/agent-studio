from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from .db_fun_base import Base


class VLMModelConfig(Base):
    __tablename__ = "vlm_model_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    space_id = Column(String(50), nullable=False, index=True)
    provider = Column(String(50), nullable=False, index=True)
    model_id = Column(String(100), nullable=False, index=True)
    api_key = Column(Text, nullable=True)
    base_url = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    timeout = Column(Integer, default=60, nullable=False)
    retry_count = Column(Integer, default=3, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<VLMModelConfig(id={self.id}, name='{self.name}', provider='{self.provider}')>"
