from typing import List

from sqlalchemy import desc
from sqlalchemy.orm import Session

from openjiuwen_studio.core.manager.repositories import BaseRepository
from openjiuwen_studio.models.model_config import ModelUsageLog


class ModelUsageRepository(BaseRepository[ModelUsageLog]):
    """Model usage log data access layer.
    
    Provides specialized database operations for model usage logs.
    """
    
    def __init__(self, db: Session):
        """Initialize model usage repository.
        
        Args:
            db: Database session
        """
        super().__init__(db, ModelUsageLog)
    
    def get_by_model_id(
        self,
        model_id: int,
        page: int = 1,
        size: int = 10
    ) -> tuple[List[ModelUsageLog], int]:
        """Get usage logs by model ID with pagination.
        
        Args:
            model_id: Model ID
            page: Page number
            size: Page size
            
        Returns:
            (List of usage logs, total count)
        """
        query = self.filter_by(model_config_id=model_id).order_by(desc(ModelUsageLog.created_at))
        
        total = query.count()
        offset = (page - 1) * size
        logs = query.offset(offset).limit(size).all()
        
        return logs, total

    def delete_by_model_id(self, model_id: int) -> int:
        """Delete all usage logs for specified model.
        
        Args:
            model_id: Model ID
            
        Returns:
            Number of deleted records
        """
        logs = self.filter_by(model_config_id=model_id)
        count = logs.count()
        logs.delete(synchronize_session=False)
        self.db.commit()
        
        return count