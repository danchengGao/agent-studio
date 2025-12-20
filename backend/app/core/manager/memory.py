from typing import Callable, Any, Awaitable
from functools import wraps
from pydantic import ValidationError
from fastapi import status
from memory_engine_start import MemoryEngineManager
from app.schemas.common import ResponseModel
from app.core.utils.exception import log_exception
from app.schemas.memory import (
    DeleteLongtermMem, DeleteVariable, UpdateLongtermMem,
    UpdateVariable, SearchLongtermMem, GetUserVar)


def get_memory_engine():
    return MemoryEngineManager.get_instance()


def with_exception_handling(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
    @wraps(func)
    async def wrapper(*args, **kwargs) -> Any:
        try:
            return await func(*args, **kwargs)   # 必须 await
        except ValidationError as e:
            log_exception(e)
            return ResponseModel(
                code=status.HTTP_400_BAD_REQUEST,
                message=type(e).__name__
            )
        except Exception as e:
            log_exception(e)
            return ResponseModel(
                code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=type(e).__name__
            )
    return wrapper


@with_exception_handling
async def get_longterm_mem(req: SearchLongtermMem):
    memory_engine = get_memory_engine()
    memory_data = await memory_engine.list_user_mem(
        user_id=req.user_id,
        group_id=req.group_id,
        num=req.num,
        page=req.page
    )
    return {"longterm_mem_data": memory_data}


@with_exception_handling
async def get_user_variable(req: GetUserVar):
    memory_engine = get_memory_engine()
    memory_data = await memory_engine.list_user_variables(
        user_id=req.user_id,
        group_id=req.group_id,
    )

    return {"variable_data": memory_data}


@with_exception_handling
async def delete_longterm_mem(req: DeleteLongtermMem):
    memory_engine = get_memory_engine()
    result = await memory_engine.delete_mem_by_id(
        user_id=req.user_id,
        group_id=req.group_id,
        mem_id=req.mem_id,
    )
    return {"result": result}


@with_exception_handling
async def delete_user_variable(req: DeleteVariable):
    memory_engine = get_memory_engine()
    result = await memory_engine.delete_user_variable(
        user_id=req.user_id,
        group_id=req.group_id,
        name=req.name
    )
    return {"result": result}


@with_exception_handling
async def update_longterm_mem(req: UpdateLongtermMem):
    memory_engine = get_memory_engine()
    result = await memory_engine.update_mem_by_id(
        user_id=req.user_id,
        group_id=req.group_id,
        mem_id=req.mem_id,
        memory=req.content)
    return {"result": result}


@with_exception_handling
async def update_user_variable(req: UpdateVariable):
    memory_engine = get_memory_engine()
    result = await memory_engine.update_user_variable(
        user_id=req.user_id,
        group_id=req.group_id,
        name=req.name,
        value=req.mem
    )
    return {"result": result}
