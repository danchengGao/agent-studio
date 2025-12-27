from pydantic import BaseModel


class GetUserVar(BaseModel):
    user_id: str
    group_id: str


class SearchLongtermMem(BaseModel):
    user_id: str
    group_id: str
    page: int
    num: int


class DeleteLongtermMem(BaseModel):
    user_id: str
    group_id: str
    mem_id: str


class DeleteVariable(BaseModel):
    user_id: str
    group_id: str
    name: str


class UpdateLongtermMem(BaseModel):
    user_id: str
    group_id: str
    mem_id: str
    content: str


class UpdateVariable(BaseModel):
    user_id: str
    group_id: str
    name: str
    mem: str