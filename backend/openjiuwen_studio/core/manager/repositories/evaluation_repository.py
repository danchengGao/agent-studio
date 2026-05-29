#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Evaluation system repository layer.

Provides data access for evaluation suites, tasks, runs, and results
using the JiuwenBaseRepository pattern.
"""
from functools import wraps
from typing import Callable

from fastapi import status

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.core.database import milliseconds
from openjiuwen_studio.core.manager.repositories import JiuwenBaseRepository
from openjiuwen_studio.core.manager.repositories.jiuwen_base_repository import get_db_jw, get_val_from_dict
from openjiuwen_studio.models.evaluation import (
    EvaluationDB, EvaluationTaskDB, EvaluationRunDB,
    EvaluationTaskResultDB, GraderDB
)
from openjiuwen_studio.schemas.common import ResponseModel


def _with_exception_handling(func) -> Callable:
    """Decorator for consistent exception handling in repository methods."""
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        try:
            return func(self, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error in evaluation repository [{func.__name__}]: {str(e)}")
            return ResponseModel(
                code=status.HTTP_400_BAD_REQUEST,
                message=f"Evaluation data processing error: {str(e)}"
            ).model_dump(exclude_none=True)
    return wrapper


class EvaluationRepository:
    """Repository for evaluation suite operations."""

    def __init__(self) -> None:
        pass

    @_with_exception_handling
    def create(self, data: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationDB)
            find_id = {"evaluation_id": get_val_from_dict(data, ["evaluation_id"])}
            ts = milliseconds()
            data.setdefault("create_time", ts)
            data.setdefault("update_time", ts)
            return repo.register_dl_in_sql(find_id=find_id, dl=data).model_dump(exclude_none=True)

    @_with_exception_handling
    def get(self, query: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationDB)
            find_id = EvaluationDB.filter_invalid_keys({
                "evaluation_id": get_val_from_dict(query, ["evaluation_id"]),
                "space_id": get_val_from_dict(query, ["space_id"]),
            })
            return repo.get_dl_in_sql(find_id=find_id, return_first_item=True).model_dump(exclude_none=True)

    @_with_exception_handling
    def list(self, query: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationDB)
            page = int(query.get("page", 1))
            size = int(query.get("size", 20))
            offset = (page - 1) * size
            find_id = EvaluationDB.filter_invalid_keys({
                "space_id": get_val_from_dict(query, ["space_id"]),
            })
            count_res = repo.count_dl_in_sql(find_id=find_id)
            total = count_res.data if count_res.code == status.HTTP_200_OK else 0
            items = []
            if total > 0:
                res = repo.get_dl_in_sql(
                    find_id=find_id,
                    order_cols_desc=["update_time"],
                    order_cols_asc=[],
                    return_range=[offset, size]
                )
                if res.code == status.HTTP_200_OK and res.data:
                    items = res.data if isinstance(res.data, list) else [res.data]
            return ResponseModel(
                code=status.HTTP_200_OK,
                message="Success",
                data={"evaluations": items, "total": total}
            ).model_dump(exclude_none=True)

    @_with_exception_handling
    def update(self, data: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationDB)
            find_id = EvaluationDB.filter_invalid_keys({
                "evaluation_id": get_val_from_dict(data, ["evaluation_id"]),
                "space_id": get_val_from_dict(data, ["space_id"]),
            })
            data.setdefault("update_time", milliseconds())
            return repo.update_dl_in_sql(find_id=find_id, update_dl=data).model_dump(exclude_none=True)

    @_with_exception_handling
    def delete(self, query: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationDB)
            find_id = EvaluationDB.filter_invalid_keys({
                "evaluation_id": get_val_from_dict(query, ["evaluation_id"]),
                "space_id": get_val_from_dict(query, ["space_id"]),
            })
            return repo.unregister_dl_in_sql(find_id=find_id).model_dump(exclude_none=True)


class EvaluationTaskRepository:
    """Repository for evaluation task operations."""

    def __init__(self) -> None:
        pass

    @_with_exception_handling
    def create(self, data: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationTaskDB)
            find_id = {
                "evaluation_id": get_val_from_dict(data, ["evaluation_id"]),
                "task_id": get_val_from_dict(data, ["task_id"]),
            }
            ts = milliseconds()
            data.setdefault("create_time", ts)
            data.setdefault("update_time", ts)
            return repo.register_dl_in_sql(find_id=find_id, dl=data).model_dump(exclude_none=True)

    @_with_exception_handling
    def get(self, query: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationTaskDB)
            find_id = EvaluationTaskDB.filter_invalid_keys({
                "evaluation_id": get_val_from_dict(query, ["evaluation_id"]),
                "task_id": get_val_from_dict(query, ["task_id"]),
            })
            return repo.get_dl_in_sql(find_id=find_id, return_first_item=True).model_dump(exclude_none=True)

    @_with_exception_handling
    def list_by_evaluation(self, evaluation_id: str) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationTaskDB)
            find_id = {"evaluation_id": evaluation_id}
            res = repo.get_dl_in_sql(find_id=find_id, order_cols_asc=["task_id"])
            if res.code == status.HTTP_404_NOT_FOUND:
                return ResponseModel(code=status.HTTP_200_OK, message="Success", data=[]).model_dump(exclude_none=True)
            return res.model_dump(exclude_none=True)

    @_with_exception_handling
    def update(self, data: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationTaskDB)
            find_id = {
                "evaluation_id": get_val_from_dict(data, ["evaluation_id"]),
                "task_id": get_val_from_dict(data, ["task_id"]),
            }
            data.setdefault("update_time", milliseconds())
            return repo.update_dl_in_sql(find_id=find_id, update_dl=data).model_dump(exclude_none=True)

    @_with_exception_handling
    def delete(self, query: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationTaskDB)
            find_id = EvaluationTaskDB.filter_invalid_keys({
                "evaluation_id": get_val_from_dict(query, ["evaluation_id"]),
                "task_id": get_val_from_dict(query, ["task_id"]),
            })
            return repo.unregister_dl_in_sql(find_id=find_id).model_dump(exclude_none=True)


class EvaluationRunRepository:
    """Repository for evaluation run operations."""

    def __init__(self) -> None:
        pass

    @_with_exception_handling
    def create(self, data: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationRunDB)
            find_id = {"run_id": get_val_from_dict(data, ["run_id"])}
            ts = milliseconds()
            data.setdefault("create_time", ts)
            data.setdefault("update_time", ts)
            return repo.register_dl_in_sql(find_id=find_id, dl=data).model_dump(exclude_none=True)

    @_with_exception_handling
    def get(self, run_id: str) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationRunDB)
            return repo.get_dl_in_sql(
                find_id={"run_id": run_id},
                return_first_item=True
            ).model_dump(exclude_none=True)

    @_with_exception_handling
    def list_by_evaluation(self, evaluation_id: str) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationRunDB)
            res = repo.get_dl_in_sql(find_id={"evaluation_id": evaluation_id}, order_cols_desc=["create_time"])
            if res.code == status.HTTP_404_NOT_FOUND:
                return ResponseModel(code=status.HTTP_200_OK, message="Success", data=[]).model_dump(exclude_none=True)
            return res.model_dump(exclude_none=True)

    @_with_exception_handling
    def delete(self, run_id: str) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationRunDB)
            return repo.unregister_dl_in_sql(find_id={"run_id": run_id}).model_dump(exclude_none=True)

    @_with_exception_handling
    def update_status(self, run_id: str, run_status: str, metrics: dict | None = None) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationRunDB)
            update_data: dict = {"status": run_status, "update_time": milliseconds()}
            if metrics is not None:
                # Preserve _metadata keys (e.g. _workflow_name, _agent_name) stored at run creation
                try:
                    existing_res = repo.get_dl_in_sql(find_id={"run_id": run_id}, return_first_item=True)
                    if existing_res.code == 200 and isinstance(existing_res.data, dict):
                        existing_metrics = existing_res.data.get("metrics") or {}
                        if isinstance(existing_metrics, dict):
                            merged = {**metrics}
                            for k, v in existing_metrics.items():
                                if k.startswith("_") and k not in merged:
                                    merged[k] = v
                            update_data["metrics"] = merged
                        else:
                            update_data["metrics"] = metrics
                    else:
                        update_data["metrics"] = metrics
                except Exception:
                    update_data["metrics"] = metrics
            return repo.update_dl_in_sql(
                find_id={"run_id": run_id},
                update_dl=update_data
            ).model_dump(exclude_none=True)


class EvaluationTaskResultRepository:
    """Repository for evaluation task result operations."""

    def __init__(self) -> None:
        pass

    @_with_exception_handling
    def create(self, data: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationTaskResultDB)
            find_id = {"result_id": get_val_from_dict(data, ["result_id"])}
            data.setdefault("create_time", milliseconds())
            return repo.register_dl_in_sql(find_id=find_id, dl=data).model_dump(exclude_none=True)

    @_with_exception_handling
    def list_by_run(self, run_id: str) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, EvaluationTaskResultDB)
            res = repo.get_dl_in_sql(find_id={"run_id": run_id}, order_cols_asc=["task_id", "trial_number"])
            if res.code == status.HTTP_404_NOT_FOUND:
                return ResponseModel(code=status.HTTP_200_OK, message="Success", data=[]).model_dump(exclude_none=True)
            return res.model_dump(exclude_none=True)


class GraderRepository:
    """Repository for reusable grader definitions."""

    def __init__(self) -> None:
        pass

    @_with_exception_handling
    def create(self, data: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, GraderDB)
            find_id = {"grader_id": get_val_from_dict(data, ["grader_id"])}
            ts = milliseconds()
            data.setdefault("create_time", ts)
            data.setdefault("update_time", ts)
            return repo.register_dl_in_sql(find_id=find_id, dl=data).model_dump(exclude_none=True)

    @_with_exception_handling
    def get(self, query: dict) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, GraderDB)
            find_id = GraderDB.filter_invalid_keys({
                "grader_id": get_val_from_dict(query, ["grader_id"]),
                "space_id": get_val_from_dict(query, ["space_id"]),
            })
            return repo.get_dl_in_sql(find_id=find_id, return_first_item=True).model_dump(exclude_none=True)

    @_with_exception_handling
    def list_by_space(self, space_id: str) -> dict:
        with get_db_jw() as db:
            repo = JiuwenBaseRepository(db, GraderDB)
            res = repo.get_dl_in_sql(find_id={"space_id": space_id}, order_cols_desc=["update_time"])
            if res.code == status.HTTP_404_NOT_FOUND:
                return ResponseModel(code=status.HTTP_200_OK, message="Success", data=[]).model_dump(exclude_none=True)
            return res.model_dump(exclude_none=True)


# Singleton instances
evaluation_repository = EvaluationRepository()
evaluation_task_repository = EvaluationTaskRepository()
evaluation_run_repository = EvaluationRunRepository()
evaluation_task_result_repository = EvaluationTaskResultRepository()
grader_repository = GraderRepository()
