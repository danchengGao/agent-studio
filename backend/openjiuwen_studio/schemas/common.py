from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar('T')


class ResponseModel(BaseModel, Generic[T]):
    model_config = ConfigDict(arbitrary_types_allowed=True)  # 允许任意类型: 跳过对sqlalchemy类型的检验
    data: Optional[T] = None
    code: int
    message: str


class PaginationParams(BaseModel):
    page: int = 1
    size: int = 20
    total: Optional[int] = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    pagination: PaginationParams
