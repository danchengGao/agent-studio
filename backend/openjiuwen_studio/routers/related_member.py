from fastapi import APIRouter, HTTPException, status, Depends, Query

from openjiuwen_studio.core.manager.login_manager.space import get_space_list, check_user_space
from openjiuwen_studio.core.manager.login_manager.user import get_current_user
from openjiuwen_studio.core.manager.repositories.prompt_relation_repository import prompt_relation_repository
from openjiuwen_studio.schemas.related_member import MemberType, RelatedMemberInfo
from openjiuwen_studio.schemas.common import ResponseModel
from openjiuwen_studio.core.manager.dfx.status import *

related_router = APIRouter()


def validate_relation_member(related_member: RelatedMemberInfo, exclude_type: MemberType) -> bool:
    if not isinstance(related_member.type, MemberType):
        return False

    # 如果提供了exclude_type，检查是否等于排除类型
    if exclude_type is not None and related_member.type == exclude_type:
        return False

    return True


@related_router.post("/prompt/{space_id}", response_model=ResponseModel[dict])
async def register(
        space_id: str,
        prompt_info: RelatedMemberInfo,
        related_member_info: RelatedMemberInfo,
        current_user: dict = Depends(get_current_user)):
    """
    注册指定space中和prompt相关联的agent或者workflow

    Args:
        prompt_info(RelatedMemberInfo): 需要关联的prompt
        related_member_info(RelatedMemberInfo): 与该prompt关联的agent或者workflow
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象。
        如果注册失败，则包含相应的错误码与提示信息。
    """
    try:
        _ = check_user_space(space_id, current_user)

        if validate_relation_member(related_member_info, MemberType.PROMPT) is False:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail=f"relation type{related_member_info.type} is invalid")

        # 创建到数据库
        ret = prompt_relation_repository.create_prompt_relate_tbl(space_id, prompt_info, related_member_info)
        if (ret.code != status.HTTP_200_OK):
            raise HTTPException(status_code=ret.code,
                                detail=ret.message)
        return ResponseModel(
            code=status.HTTP_200_OK,
            message="relation registered successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error") from e


@related_router.post("/prompt/list/{space_id}", response_model=ResponseModel[list[dict]])
async def get_relation(
        space_id: str,
        key_member_info: RelatedMemberInfo,
        only_activate: bool = Query(default=False, description="是否只返回激活的数据"),
        current_user: dict = Depends(get_current_user)):
    """
    注册指定space中和prompt相关联的agent或者workflow

    Args:
        key_member_info(RelatedMemberInfo): 用来查找关联关系的对象
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象。
        如果注册失败，则包含相应的错误码与提示信息。
    """
    try:
        _ = check_user_space(space_id, current_user)

        # 从数据库获取
        ret = prompt_relation_repository.get_prompt_relate_tbl(space_id, key_member_info, only_activate)

        # 如果没有找到关联数据（404），返回空列表而不是抛出异常
        if ret.code == status.HTTP_404_NOT_FOUND:
            return ResponseModel(
                code=status.HTTP_200_OK,
                message="get relation successfully",
                data=[]
            )
        
        if (ret.code != status.HTTP_200_OK):
            raise HTTPException(status_code=ret.code,
                                detail=ret.message)
        return ResponseModel(
            code=status.HTTP_200_OK,
            message="get relation successfully",
            data=ret.data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error") from e


@related_router.delete("/prompt/{space_id}", response_model=ResponseModel[list[dict]])
async def delete_relation(
        space_id: str,
        key_member_info: RelatedMemberInfo,
        current_user: dict = Depends(get_current_user)):
    """
    注册指定space中和prompt相关联的agent或者workflow

    Args:
        key_member_info(RelatedMemberInfo): 用来查找关联关系的对象
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象。
        如果注册失败，则包含相应的错误码与提示信息。
    """
    try:
        _ = check_user_space(space_id, current_user)

        # 创建到数据库
        ret = prompt_relation_repository.delete_prompt_relate_tbl(space_id, key_member_info)

        if (ret.code != status.HTTP_200_OK):
            raise HTTPException(status_code=ret.code,
                                detail=ret.message)
        return ResponseModel(
            code=status.HTTP_200_OK,
            message="relation delete successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error") from e
