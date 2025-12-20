from fastapi import APIRouter, Depends, HTTPException, Query, status
from openjiuwen.core.common.logging import logger

from app.core.database import milliseconds
from app.core.manager.login_manager.session_auth import hash_password
from app.core.manager.login_manager.user import (create_user_response,
                                                 get_current_user,
                                                 verify_current_user)
from app.core.manager.repositories.user_repository import user_repository
from app.schemas.common import ResponseModel
from app.schemas.user import RoleType, UserDBPd, UserResponse, UserUpdate

users_router = APIRouter()


@users_router.get("/{user_id}", response_model=ResponseModel[UserResponse])
async def get_user(
        user_id: str,
        current_user: dict = Depends(get_current_user)
):
    """Get a specific user by ID"""
    try:
        user_db_dict = verify_current_user(current_user, user_id)

        user_response = create_user_response(UserDBPd(**user_db_dict), True)
        return ResponseModel(
            code=status.HTTP_200_OK,
            message="User retrieved successfully",
            data=user_response.model_dump()
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@users_router.put("/{user_id}", response_model=ResponseModel[UserResponse])
async def update_user(
        user_id: str,
        user_update: UserUpdate,
        current_user: dict = Depends(get_current_user)
):
    """Update a user"""
    try:
        user_db_dict = verify_current_user(current_user, user_id)

        user_db = UserDBPd(**user_db_dict)
        # Update user
        update_data = user_update.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(user_db, field):
                if field == "password":
                    value = hash_password(value)
                setattr(user_db, field, value)
        user_db.user_update_time = milliseconds()
        user_repository.update_user_tbl(user_info={**user_db.model_dump(), 'role_type': user_db.role_type.value})
        user_response = create_user_response(user_db, True)

        return ResponseModel(
            code=status.HTTP_200_OK,
            message="success to update user",
            data=user_response.model_dump()
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@users_router.delete("/{user_id}", response_model=ResponseModel[dict])
async def delete_user(
        user_id: str,
        current_user: dict = Depends(get_current_user)
):
    """Delete a user"""
    try:
        user_db_dict = verify_current_user(current_user, user_id)

        ret = user_repository.delete_user_tbl(email=user_db_dict["email"])
        if ret["code"] != status.HTTP_200_OK:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Failed to delete user from database")
        return ResponseModel(
            code=status.HTTP_200_OK,
            message="User deleted successfully",
            data={"id": user_db_dict["user_id_str"], "username": user_db_dict["username"]}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
