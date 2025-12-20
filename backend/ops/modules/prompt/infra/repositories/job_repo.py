#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import Optional, List
from sqlalchemy.orm import Session

from ops.modules.prompt.domain.repositories import JobRepository
from ops.modules.prompt.infra.database import Base


class SQLJobRepository(JobRepository):
    def __init__(self, db: Session):
        self.db = db

    def save(self, db_job: Base) -> None:
        self.db.add(db_job)
        self.db.commit()
        self.db.refresh(db_job)

    def update(self, new_db_job: Base) -> None:
        self.db.commit()
        self.db.refresh(new_db_job)

    def find_draft_by_id(self, space_id: str, user_id: str, jobmodel: Base) -> Optional[List[Base]]:
        db_jobs = self.db.query(jobmodel).filter(
            jobmodel.space_id == space_id,
            jobmodel.user_id == user_id,
            jobmodel.is_deleted == 0
        ).all()
        return db_jobs

    def find_draft_by_draft_id(self, draft_id: str, jobmodel: Base) -> Optional[Base]:
        """
        interface define
        """
        db_job = self.db.query(jobmodel).filter(
            jobmodel.id == int(draft_id),
            jobmodel.is_deleted == 0
        ).first()
        return db_job if db_job else None

    def find_job_by_job_id(self, job_id: str, space_id: str, user_id: str, jobmodel: Base) -> Optional[Base]:
        """
        interface define
        """

        db_job = self.db.query(jobmodel).filter(
            jobmodel.space_id == space_id,
            jobmodel.user_id == user_id,
            jobmodel.is_deleted == 0,
            jobmodel.job_id == job_id
        ).first()
        return db_job

    def find_jobs_by_user(self, space_id: str, user_id: str, jobmodel: Base) -> Optional[List[Base]]:
        """查询用户的所有任务"""
        return self.db.query(jobmodel).filter(
            jobmodel.space_id == space_id,
            jobmodel.user_id == user_id,
            jobmodel.is_deleted == 0
            ).order_by(jobmodel.created_at.desc()).all()

    def find_jobs_by_job_ids(
        self, job_ids: List[str], space_id: str, user_id: str, JobUserInfoModel: Base
    ) -> Optional[List[Base]]:
        """根据job_id列表查询任务"""
        return self.db.query(JobUserInfoModel).filter(
            JobUserInfoModel.job_id.in_(job_ids),
            JobUserInfoModel.space_id == space_id,
            JobUserInfoModel.user_id == user_id,
            JobUserInfoModel.is_deleted == 0
        ).order_by(JobUserInfoModel.created_at.desc()).all()